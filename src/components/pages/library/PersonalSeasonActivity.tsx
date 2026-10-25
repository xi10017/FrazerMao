import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export interface PersonalActivity {
  rank: number | null; todayCompleted: number; todayPoints: number; seasonPoints: number; dailyCap: number;
  days: { date: string; completed: number; points: number }[];
}
export function PersonalSeasonActivity({ activity }: { activity: PersonalActivity }) {
  return <section aria-label="Your private season activity" className="space-y-3 rounded-md border p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="text-sm text-muted-foreground">Today’s award points</h3><p className="text-2xl font-semibold">{activity.todayPoints} / {activity.dailyCap}</p></div>
      <p className="text-sm text-muted-foreground">{activity.todayCompleted} tests completed today · Eastern time</p>
    </div>
    <details><summary className="cursor-pointer text-sm font-medium">Daily activity · last 7 days</summary>
      <Table><TableHeader><TableRow><TableHead>Date (Eastern)</TableHead><TableHead>Completed</TableHead><TableHead>Points</TableHead></TableRow></TableHeader>
        <TableBody>{activity.days.map(day=><TableRow key={day.date}><TableCell>{day.date}</TableCell><TableCell>{day.completed}</TableCell><TableCell>{day.points} / {activity.dailyCap}</TableCell></TableRow>)}</TableBody>
      </Table>
    </details>
  </section>;
}
