import { injectable, inject } from 'tsyringe';
import { JobEfficiency } from './job-efficiency.types';

@injectable()
export class JobEfficiencyService {
    constructor(
        @inject('window') private window: any
    ) {}

    getJobData(jobId: number, x: number, y: number): Promise<any> {
        return new Promise((resolve) => {
            this.window.Ajax.remoteCallMode('job', 'job', { jobId, x, y }, (data: any) => {
                resolve(data);
            });
        });
    }

    calculateFromData(job: any, data: any, duration: number): JobEfficiency {
        let durationIndex = 0;
        if (duration >= 3600) durationIndex = 2;
        else if (duration >= 600) durationIndex = 1;

        const dur = data.durations[durationIndex];
        const actualDuration = dur.duration;
        const xp = dur.xp + (dur.featured_xp || 0);
        const money = dur.money + (dur.featured_money || 0);
        const energy = dur.cost;

        const xpPerHour = Math.round(xp * (3600 / actualDuration));
        const moneyPerHour = Math.round(money * (3600 / actualDuration));
        const energyPerHour = Math.round(energy * (3600 / actualDuration));
        const efficiencyScore = energyPerHour > 0
            ? Math.round(xpPerHour / energyPerHour)
            : 0;

        return {
            jobId: job.id,
            jobName: job.name,
            xpPerHour,
            moneyPerHour,
            energyPerHour,
            efficiencyScore
        };
    }

    async getBestJobs(duration: number): Promise<JobEfficiency[]> {
        const { JobList, Character } = this.window;
        const pos = Character.position;
        const jobs = JobList.getSortedJobs('id');
        const results: JobEfficiency[] = [];

        // Minimap verisi al
        const minimap = await new Promise<any>((resolve) => {
            this.window.Ajax.get('map', 'get_minimap', {}, (data: any) => {
                resolve(data);
            });
        });

        for (const job of jobs) {
            const group = minimap.job_groups[job.groupid];
            if (!group || !group.length) continue;

            // En yakın konumu bul
            const nearest = group.sort((a: number[], b: number[]) =>
                Math.abs(a[0] - pos.x) + Math.abs(a[1] - pos.y) -
                (Math.abs(b[0] - pos.x) + Math.abs(b[1] - pos.y))
            )[0];

            const data = await this.getJobData(job.id, nearest[0], nearest[1]);
            if (data.error || !data.durations) continue;

            results.push(this.calculateFromData(job, data, duration));
        }

        return results
            .sort((a, b) => b.efficiencyScore - a.efficiencyScore)
            .slice(0, 15);
    }
}