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
    const durations = this.window.JobList.getDurations(job.id);
    
    // Hangi süreye en yakın olduğunu bul
    let durationKey = 'short';
    if (duration >= 3600) durationKey = 'long';
    else if (duration >= 600) durationKey = 'middle';
    
    const actualDuration = durations[durationKey]?.duration || duration;
    const jobPoints = job.calcJobPoints();
    
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