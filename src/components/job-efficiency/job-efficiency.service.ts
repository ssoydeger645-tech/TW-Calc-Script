import { injectable, inject } from 'tsyringe';
import { JobEfficiency } from './job-efficiency.types';
import { Logger } from '../logger/logger';

@injectable()
export class JobEfficiencyService {
    constructor(
        @inject('window') private window: any,
        private logger: Logger
    ) {}

    // Tek çalışma için verim hesapla
    calculate(job: any, duration: number): JobEfficiency {
        const xpPerHour = Math.round(job.experience * (3600 / duration));
const moneyPerHour = Math.round(job.value * (3600 / duration));
        const energyPerHour = Math.round(job.malus * (3600 / duration));
        const efficiencyScore = energyPerHour > 0 
            ? Math.round(xpPerHour / energyPerHour) 
            : 0;

        this.logger.log(`Hesaplanan verim: ${job.name}`, {
            xpPerHour,
            moneyPerHour,
            energyPerHour,
            efficiencyScore
        });

        return {
            jobId: job.id,
            jobName: job.name,
            xpPerHour,
            moneyPerHour,
            energyPerHour,
            efficiencyScore
        };
    }

    // Tüm çalışmaları karşılaştır ve sırala
    getBestJobs(duration: number): JobEfficiency[] {
        const { JobList } = this.window;
        const jobs = JobList.getSortedJobs('id');
        
        return jobs
            .map((job: any) => this.calculate(job, duration))
            .sort((a: JobEfficiency, b: JobEfficiency) => 
                b.efficiencyScore - a.efficiencyScore
            )
            .slice(0, 15); // En iyi 15 çalışma
    }
}