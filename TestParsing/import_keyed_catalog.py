#!/usr/bin/env python3
"""Match spreadsheet answer keys to indexed FAMAT documents; preserve existing entries.

Use --cache-dir for fetched search pages and --apply to update the catalog.
Without --apply, only a JSON audit report is written. No spreadsheet is modified.
"""
from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as E
import re,json,collections,posixpath
ROOT=Path(__file__).resolve().parents[1]
N={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main','r':'http://schemas.openxmlformats.org/officeDocument/2006/relationships'}
def sheets(path):
 with ZipFile(path) as z:
  shared=[]
  if 'xl/sharedStrings.xml' in z.namelist():
   shared=[''.join(n.itertext()) for n in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',N)]
  rel={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))}
  for s in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',N):
   target=rel[s.attrib['{'+N['r']+'}id']]; target=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target)
   rows=[]
   for row in E.fromstring(z.read(target)).findall('s:sheetData/s:row',N):
    values={}
    for c in row.findall('s:c',N):
     col=re.match('[A-Z]+',c.attrib['r'])[0]; idx=0
     for ch in col:idx=idx*26+ord(ch)-64
     v=c.find('s:v',N);t=c.attrib.get('t'); value=v.text if v is not None else None
     if t=='s' and value is not None:value=shared[int(value)]
     elif t=='inlineStr':value=''.join(c.find('s:is',N).itertext())
     values[idx-1]=value
    rows.append((int(row.attrib['r']),values))
   yield s.attrib['name'],rows

import argparse,html,urllib.request,urllib.parse,concurrent.futures,importlib.util
LEVELS={'Alg1':'Algebra I','Alg2':'Algebra II','Geo':'Geometry','Mu':'Calculus/Mu','Alpha':'Precalculus/Alpha','Theta':'Theta','Stats':'Statistics'}
REG_FILES={'Alg 1':'Alg1','Alg 2':'Alg2','Geo':'Geo','Calc':'Mu','Precalc':'Alpha','Stats':'Stats'}
TOPICS={'ind':'Individual','indiv':'Individual','individual':'Individual','unplug':'Unplugged Individual','unplugged':'Unplugged Individual','anal':'Analytic Geometry','apps':'Applications','comp':'Complex Numbers','eq':'Equations and Inequalities','logs':'Logs and Exponents','m&v':'Matrices and Vectors','s&s':'Sequences and Series','trig':'Trigonometry','func':'Functions','polar':'Polar Coordinate System','conic':'Conics and Coordinate Geometry','conics':'Conics and Coordinate Geometry','combo':'Combinatorics','a&v':'Area and Volume','av':'Area and Volume','integ':'Integration','l&d':'Limits and Derivatives','limits':'Limits and Derivatives','bc':'BC Calculus','diffeq':'Differential Equations','geom':'Geometry','geo':'Geometry','2d':'2D Geometry','3d':'3D Geometry','tri':'Triangles','trg':'Triangles','cpav':'Circumference, Perimeter, Area, and Volume','cp':'Circles and Polygons','coord':'Coordinate Geometry','m&d':'Matrices and Determinants','quad':'Quadrilaterals','circle':'Circles'}
def answer(value):
 if value is None:return None
 value=re.sub(r'\([^)]*\)','',str(value)).strip().upper()
 if value.startswith('*') or value in {'X','THROW','THROWN','THROWNOUT','THROWN OUT','TO'}:return ['A','B','C','D','E']
 parts=re.split(r'\s*(?:/|\bOR\b)\s*',value)
 if len(parts)==1 and re.fullmatch('[ABCDE]+',value):parts=list(value)
 if not parts or any(p not in 'ABCDE' or len(p)!=1 for p in parts):return None
 parts=sorted(set(parts));return parts[0] if len(parts)==1 else parts

def colname(n):
 result=''
 while n:n,r=divmod(n-1,26);result=chr(65+r)+result
 return result

def load_keys():
 keys={};unidentified=[]
 for folder in ['regular season','states','nationals']:
  for path in sorted((ROOT/'TestParsing'/folder).glob('*.xlsx')):
   division=REG_FILES[path.name.split(' Reg Season')[0]] if folder=='regular season' else path.name.split()[0]
   for sheet,rawrows in sheets(path):
    rows=dict(rawrows);topic=None
    for col,header in sorted(rows.get(1,{}).items()):
     h=str(header or '').strip();year=None;month=None;fmt=None
     vals=[answer(rows.get(r,{}).get(col)) for r in range(2,32)]
     if not any(v is not None for v in vals):continue
     if folder=='regular season':
      match=re.fullmatch(r'(Jan|Feb|Mar)(\d{2})([IR])',h,re.I)
      alt=re.fullmatch(r'(Jan|Feb|Mar)([IR])(\d{2})',h,re.I)
      if match:mo,yr,kind=match.groups()
      elif alt:mo,kind,yr=alt.groups()
      elif path.name=='Precalc Reg Season.xlsx' and h=='PRECALC':mo,yr,kind='Jan','16','R'
      elif h=='Ferb10I':mo,yr,kind='Feb','10','I'
      else:unidentified.append({'file':str(path.relative_to(ROOT)),'sheet':sheet,'column':colname(col+1),'header':h});continue
      month={'jan':'January','feb':'February','mar':'March'}[mo.lower()];year=2000+int(yr);kind='Regional' if kind.upper()=='R' else 'Invitational';fmt='Individual'
     else:
      if re.fullmatch(r'\d{4}(?:\.0)?',h):year=int(float(h));fmt=topic
      else:
       match=re.fullmatch(r'(.+?)(\d{4}|\d{2})',h)
       if not match:topic=None;continue
       rawtopic,yr=match.groups();year=int(yr);year=year if year>=1900 else 2000+year
       topic=TOPICS.get(rawtopic.lower());fmt=topic
       if not fmt:unidentified.append({'file':str(path.relative_to(ROOT)),'sheet':sheet,'column':colname(col+1),'header':h});continue
      kind='States' if folder=='states' else 'Nationals'
     if not fmt:continue
     key=(division,year,month,kind,fmt)
     keys.setdefault(key,[]).append({'answers':vals,'file':str(path.relative_to(ROOT)),'sheet':sheet,'range':f'{colname(col+1)}1:{colname(col+1)}31','header':h})
 return keys,unidentified

def entry_key(t):return(t['division'],t['year'],t.get('month'),t['test_type'],t['format'])
def test_id(t):return re.sub(r'[()]','',re.sub(r'\s+','-',f"{t['year']}{'-'+t['month'] if t.get('month') else ''}-{t['division']}-{t['test_type']}-{t['format']}".lower()))
def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':'MuPractice/1.0'})
 with urllib.request.urlopen(req,timeout=40) as r:return r.read()

def load_national_archive(cache):
 documents=[]
 canonical={v.casefold():v for v in TOPICS.values()}
 aliases={'area':'Area and Volume','area & volume':'Area and Volume','equations & inequalities':'Equations and Inequalities','limits & derivatives':'Limits and Derivatives','sequences & series':'Sequences and Series','matrices & vectors':'Matrices and Vectors','logarithms and exponents':'Logs and Exponents','counting and probability':'Combinatorics'}
 def text(raw):return html.unescape(re.sub('<[^>]+>','',raw)).strip()
 for path in sorted((cache/'nationals').glob('*.html')):
  for row in re.findall(r'<tr[^>]*>(.*?)</tr>',path.read_text(),re.S):
   cells=re.findall(r'<td\b[^>]*>(.*?)</td>',row,re.S)
   if len(cells)!=6:continue
   year,convention,category,division,topic=map(text,cells[:5])
   if not year.isdigit() or division not in ['Alpha','Mu','Theta']:continue
   if 'individual' in category.lower():fmt='Individual'
   elif 'topic' in category.lower():fmt=aliases.get(topic.casefold(),canonical.get(topic.casefold()))
   else:continue
   if not fmt:continue
   for href,label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>',cells[5],re.S):
    label=text(label).lower()
    if label=='test':dtype='Test'
    elif label in ['solutions','answers']:dtype='Solution'
    else:continue
    url=urllib.parse.urljoin('https://mualphatheta.org/',html.unescape(href))
    documents.append({'name':'/docs/'+urllib.parse.unquote(url.split('/')[-1]),'url':url,'document_type':dtype,'year':int(year),'month':None,'division':division,'test_type':'Nationals','format':fmt,'source':'Mu Alpha Theta national archive'})
 return documents

def load_convention_drive():
 documents=[]
 paths=[]
 for filename in ['convention_drive_manifest.json','convention_public_manifest.json']:
  p=ROOT/'TestParsing/imports'/filename
  if p.exists():paths.extend(json.loads(p.read_text()))
 normalize=lambda s: re.sub(r'[^a-z0-9]+',' ',s.lower().replace('&',' and ')).strip()
 aliases={normalize(v):v for v in TOPICS.values()}
 aliases.update({'complex':'Complex Numbers','analytic geo':'Analytic Geometry','limits and der':'Limits and Derivatives','logs and exponentials':'Logs and Exponents','logs exponents':'Logs and Exponents','equations inequalities':'Equations and Inequalities','matrices vectors':'Matrices and Vectors','cpav':'Circumference, Perimeter, Area, and Volume','conics':'Conics and Coordinate Geometry'})
 for f in paths:
  path=f['path'];parts=path.split('/');yearparts=[int(t) for t in parts[:-1] if re.fullmatch(r'20\d{2}',t)]
  nats=re.search(r'Nationals (20\d{2})',path,re.I)
  if nats:year=int(nats.group(1));kind='Nationals'
  elif yearparts:year=yearparts[-1];kind='States'
  else:continue
  filename=parts[-1]
  if not re.search(r'\.(pdf|docx?)$',filename,re.I):continue
  context=' '.join(parts[1:]);division=None
  for pattern,d in [(r'\balpha\b|\bprecalc(?:ulus)?\b','Alpha'),(r'\btheta\b','Theta'),(r'\bmu\b|\bcalc(?:ulus)?\b','Mu'),(r'\bstats?\b|\bstatistics\b','Stats')]:
   if re.search(pattern,context,re.I):division=d;break
  if not division:continue
  fmt=None
  for part in reversed(parts[1:]):
   clean=normalize(part)
   if re.search(r'\b(individual|indiv)\b',clean):fmt='Unplugged Individual' if 'unplug' in clean else 'Individual';break
   if re.search(r'cipher|bowl|relay|gemini|hustle|computer|interschool',clean):continue
   for alias,canonical in sorted(aliases.items(),key=lambda x:len(x[0]),reverse=True):
    if alias not in ['individual','unplugged individual'] and re.search(r'\b'+re.escape(alias)+r'\b',clean):fmt=canonical;break
   if fmt:break
  if not fmt:continue
  dtype='Solution' if re.search(r'ans|sol|key',filename,re.I) else 'Test'
  documents.append({'name':f"/docs/{f['id']} {'S' if dtype=='Solution' else 'T'}_ {filename}",'url':f"https://drive.google.com/file/d/{f['id']}/view",'document_type':dtype,'year':year,'month':None,'division':division,'test_type':kind,'format':fmt,'source':'FAMAT public convention archive'})
 return documents

def verify_links(pending,cache):
 checks_path=ROOT/'TestParsing/reports/keyed-catalog-links.json'
 fallback=cache/'link-checks.json'
 checks=json.loads(checks_path.read_text()) if checks_path.exists() else json.loads(fallback.read_text()) if fallback.exists() else {}
 known_drive=set()
 for name in ['drive_regionals_manifest.json','convention_drive_manifest.json','convention_public_manifest.json']:
  p=ROOT/'TestParsing/imports'/name
  if p.exists():known_drive.update(f['id'] for f in json.loads(p.read_text()))
 def check(url):
  if checks.get(url,{}).get('valid'):return url,checks[url]
  if 'drive.google.com/file/d/' in url:
   fid=url.split('/file/d/')[1].split('/')[0]
   return url,{'valid':fid in known_drive,'method':'File ID in public source folder manifest'}
  for attempt in range(2):
   try:
    request=urllib.request.Request(url,headers={'User-Agent':'MuPractice/1.0','Range':'bytes=0-15'})
    with urllib.request.urlopen(request,timeout=15) as response:
     prefix=response.read(16);valid=response.status in [200,206] and (prefix.startswith(b'%PDF') or prefix.startswith(b'PK') or prefix.startswith(bytes.fromhex('d0cf11e0')))
     return url,{'valid':valid,'status':response.status,'content_type':response.headers.get('Content-Type'),'method':'HTTP response and PDF/Office signature'}
   except Exception as exc:
    error=str(exc)
    if '404' in error or '403' in error:break
  return url,{'valid':False,'error':error}
 urls=sorted({item[k]['url'] for item in pending for k in ['test','solution']})
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
  for i,(url,result) in enumerate(executor.map(check,urls)):
   checks[url]=result
   if i%100==0:print(f'Verified {i}/{len(urls)} document links',flush=True)
 checks_path.write_text(json.dumps({u:checks[u] for u in urls},indent=2)+'\n')
 valid=[];rejected=[]
 for item in pending:
  failed=[item[k]['url'] for k in ['test','solution'] if not checks[item[k]['url']]['valid']]
  if failed:rejected.append({'key':item['key'],'reason':'document unavailable or not verified','urls':failed,'sources':[item['source']]})
  else:valid.append(item)
 return valid,rejected

def run(args):
 cache=Path(args.cache_dir);cache.mkdir(parents=True,exist_ok=True)
 spec=importlib.util.spec_from_file_location('famat_extractor',ROOT/'TestParsing/extract_famat_tests.py');extractor=importlib.util.module_from_spec(spec);spec.loader.exec_module(extractor)
 docsfile=cache/'docs.html'
 if not docsfile.exists():docsfile.write_bytes(fetch('https://tests.famat.org/docs/'))
 docs={}
 for encoded in extractor.DOCS_HREF_RE.findall(docsfile.read_text()):
  filename=urllib.parse.unquote(html.unescape(encoded));match=re.match(r'^(\d+)\s',filename)
  if match:docs[int(match.group(1))]=extractor.document_entry(filename)
 documents=[]
 for division,level in LEVELS.items():
  path=cache/(level.replace('/','_').replace(' ','_')+'.html')
  if not path.exists():path.write_bytes(fetch('https://tests.famat.org/?'+urllib.parse.urlencode({'level':level,'submit':'Search'})))
  for record in extractor.parse_results(path.read_text(),level):
   for label,tid in record['downloads'].items():
    doc=docs.get(tid)
    if doc:
     e=extractor.to_famat_entry(record,label,tid,doc,division)
     if e.get('year') and e['document_type'] in ['Test','Solution']:documents.append(e)
 # Existing manifests supply newer Google Drive documents not in the public bank.
 for path in (ROOT/'TestParsing/imports').glob('*_famat_import.json'):
  documents.extend(json.loads(path.read_text()))
 documents.extend(json.loads((ROOT/'TestParsing/imports/drive_regionals_import.json').read_text()))
 # Include Invitational records from the same cached manifest, not just Regionals.
 manifest=json.loads((ROOT/'TestParsing/imports/drive_regionals_manifest.json').read_text())
 ds=importlib.util.spec_from_file_location('drive_extractor',ROOT/'TestParsing/extract_drive_regionals.py')
 # Metadata for these is parsed below without importing its answer-key dependencies.
 for item in manifest:
  path=item['path'];low=path.lower();filename=path.split('/')[-1]
  yy=re.search(r'20\d{2}',path);mo=re.search(r'\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?)\b',path,re.I)
  if not yy or not mo or not re.search(r'indiv|individual',filename,re.I):continue
  div=None
  for pattern,d in [(r'\balg(?:ebra)?\s*1\b','Alg1'),(r'\balg(?:ebra)?\s*2\b','Alg2'),(r'\bgeo(?:metry)?\b','Geo'),(r'\bprecalc(?:ulus)?\b|\balpha\b','Alpha'),(r'\bcalc(?:ulus)?\b|\bmu\b','Mu'),(r'\bstats?\b|\bstatistics\b','Stats'),(r'\btheta\b','Theta')]:
   if re.search(pattern,path,re.I):div=d;break
  if not div:continue
  if re.search(r'interschool|dostal|hiller|nunn|open tests',path,re.I):continue
  kind='Invitational' if re.search(r'invitational|statewide',path,re.I) else 'Regional' if re.search(r'regional',path,re.I) else None
  if not kind:continue
  dtype='Solution' if re.search(r'ans|sol',filename,re.I) else 'Test'
  documents.append({'name':f"/docs/{item['id']} {'S' if dtype=='Solution' else 'T'}_ {filename}",'url':f"https://drive.google.com/file/d/{item['id']}/view",'document_type':dtype,'year':int(yy.group()),'month':{'jan':'January','feb':'February','mar':'March'}[mo.group()[:3].lower()],'division':div,'test_type':kind,'format':'Individual'})
 supplemental=ROOT/'TestParsing/imports/national_archive_supplement.json'
 if supplemental.exists():documents.extend(json.loads(supplemental.read_text()))
 archive_manifest=ROOT/'TestParsing/imports/national_archive_table.json'
 documents.extend(json.loads(archive_manifest.read_text()) if archive_manifest.exists() else load_national_archive(cache))
 documents.extend(load_convention_drive())
 # Some official files contain both questions and worked solutions.
 combined=[]
 for doc in documents:
  name=doc.get('name','')
  if re.search(r'(?:with|and|&)\s+(?:sol|ans)',name,re.I) and re.search(r'indiv|individual|test',name,re.I):
   combined.append({**doc,'document_type':'Solution' if doc['document_type']=='Test' else 'Test'})
 documents.extend(combined)
 bykey={}
 for doc in documents:
  if doc.get('url','').startswith('https://tests.famat.org/') and re.search(r'\.docx?\.pdf$',doc['url'],re.I):
   doc={**doc,'url':doc['url'][:-4],'name':doc['name'][:-4]}
  if all(f in doc for f in ['division','year','test_type','format','url']):bykey.setdefault(entry_key(doc),{}).setdefault(doc['document_type'],[]).append(doc)
 data=json.loads((ROOT/'src/data/famat_tests.json').read_text());existing={entry_key(t) for t in data if t['document_type']=='Test'}
 keys,unknown=load_keys();pending=[];skipped=[]
 repairs_path=ROOT/'TestParsing/imports/verified_key_repairs.json'
 for repair in json.loads(repairs_path.read_text()) if repairs_path.exists() else []:
  for source in keys.get(tuple(repair['key']),[]):
   if source['answers'][repair['question']-1] is None:
    source['answers'][repair['question']-1]=repair['answer'];source.setdefault('repairs',[]).append(repair)
 checksfile=ROOT/'TestParsing/reports/keyed-catalog-links.json'
 if not checksfile.exists():checksfile=cache/'link-checks.json'
 checks=json.loads(checksfile.read_text()) if checksfile.exists() else {}
 for k,sources in keys.items():
  if k in existing:continue
  complete=[s for s in sources if all(a is not None for a in s['answers'])]
  if not complete:skipped.append({'key':k,'reason':'incomplete answer key','sources':sources});continue
  distinct={json.dumps(s['answers']) for s in complete}
  if len(distinct)>1:skipped.append({'key':k,'reason':'conflicting duplicate answer keys','sources':sources});continue
  docs_for=bykey.get(k,{})
  if not docs_for.get('Test') or not docs_for.get('Solution'):skipped.append({'key':k,'reason':'missing test or solution document','sources':sources});continue
  def best(ds):
   return sorted(ds,key=lambda d:(checks.get(d['url'],{}).get('valid') is False,not d['url'].startswith('https://drive.google.com/'),not d['name'].lower().endswith('.pdf'),'condensed' in d['name'].lower(),d['name']))[0]
  t=dict(best(docs_for['Test']));s=dict(best(docs_for['Solution']));source=complete[0]
  s.update(answers=source['answers'],csv_validated=True,csv_source=f"{source['sheet']}!{source['range']} ({source['header']})",answer_key_file=source['file'])
  pending.append({'key':k,'test':t,'solution':s,'source':source})
 if args.verify_links:
  pending,unavailable=verify_links(pending,cache)
  skipped.extend(unavailable)
 elif args.apply:
  raise SystemExit('Use --verify-links with --apply; unverified documents are never imported.')
 out={'before':len(existing),'candidates':len(keys),'unknown_headers':unknown,'matched':pending,'skipped':skipped}
 report=ROOT/'TestParsing/reports/keyed-catalog-import.json';report.write_text(json.dumps(out,indent=2)+'\n')
 print('Existing',len(existing),'matched pairs',len(pending),'skipped',len(skipped),'unknown headers',len(unknown),flush=True)
 print('Matched by competition',dict(collections.Counter(p['key'][3] for p in pending)),flush=True)
 if args.apply:
  data.extend(doc for p in pending for doc in [p['test'],p['solution']]);(ROOT/'src/data/famat_tests.json').write_text(json.dumps(data,indent=4,ensure_ascii=False)+'\n');print('Applied',len(pending),'tests',flush=True)
 return out
if __name__=='__main__':
 parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--cache-dir',default='/tmp/famat-source-cache');parser.add_argument('--apply',action='store_true');parser.add_argument('--verify-links',action='store_true');run(parser.parse_args())
