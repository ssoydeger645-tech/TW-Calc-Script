import { injectable, inject } from 'tsyringe';
import { JobEfficiency } from './job-efficiency.types';
import { Logger } from '../logger/logger';

@injectable()
export class JobEfficiencyService {
    constructor(
        @inject('window') private window: any,
        private logger: Logger
    ) {}

    calculate(job: any, duration: number): JobEfficiency {
        const durations = this.window.JobList.getDurations(job.id);
        let durationKey = 'short';
        if (duration >= 3600) durationKey = 'long';
        else if (duration >= 600) durationKey = 'middle';
        const actualDuration = durations[durationKey]?.duration || duration;
        const jobPoints = job.calcJobPoints();
        const xpPerHour = Math.round(jobPoints * (3600 / actualDuration));
        const moneyPerHour = Math.round(jobPoints * 0.5 * (3600 / actualDuration));
        const energyPerHour = Math.round(job.malus * (3600 / actualDuration));
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

    getBestJobs(duration: number): JobEfficiency[] {
        const { JobList } = this.window;
        const jobs = JobList.getSortedJobs('id');
        return jobs
            .map((job: any) => this.calculate(job, duration))
            .sort((a: JobEfficiency, b: JobEfficiency) =>
                b.efficiencyScore - a.efficiencyScore
            )
            .slice(0, 15);
    }
}