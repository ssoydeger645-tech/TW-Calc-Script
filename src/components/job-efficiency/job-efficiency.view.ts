import { injectable, inject } from 'tsyringe';
import { JobEfficiencyService } from './job-efficiency.service';
import { ErrorTracker } from '../error-tracker/error-tracker';
import { WestCalcWindowTab } from '../west-calc/west-calc-window.types';

@injectable()
export class JobEfficiencyView {
    key = WestCalcWindowTab.JobEfficiency;
    title = 'İş Verimliliği';

    constructor(
        @inject('window') private window: any,
        private jobEfficiencyService: JobEfficiencyService,
        private errorTracker: ErrorTracker
    ) {}

    init() {}

    getMainDiv() {
        const { west, $ } = this.window;
        const container = $('<div style="padding: 10px;"></div>');

        container.append(
            $('<h3 style="margin-bottom: 10px;">Çalışma Verimliliği Hesaplayıcı</h3>')
        );

        const durationLabel = $('<span style="margin-right: 8px;">Çalışma süresi: </span>');
        const durationSelect = new west.gui.Combobox('TWCalc_JobEff_Duration')
            .addItem(15, '15 saniye')
            .addItem(600, '10 dakika')
            .addItem(3600, '1 saat')
            .setWidth(150);

        const resultsDiv = $('<div id="TWCalc_JobEff_Results"></div>');

        const calcBtn = new west.gui.Button()
            .setCaption('Hesapla')
            .click(() => {
                this.errorTracker.execute(async () => {
                    resultsDiv.html('<div style="text-align:center; padding: 20px;">Yükleniyor...</div>');
                    const results = await this.jobEfficiencyService.getBestJobs(
                        Number(durationSelect.getValue())
                    );
                    this.showResults(results, resultsDiv);
                });
            });

        const controlsDiv = $('<div style="margin-bottom: 15px; display: flex; align-items: center;"></div>');
        controlsDiv.append(durationLabel);
        controlsDiv.append(durationSelect.getMainDiv());
        controlsDiv.append($('<span style="margin: 0 8px;"></span>'));
        controlsDiv.append(calcBtn.getMainDiv());

        container.append(controlsDiv);
        container.append(resultsDiv);

        return container;
    }

    showResults(results: any[], resultsDiv: any) {
        const { $ } = this.window;

        const scrollpane = new this.window.west.gui.Scrollpane();

        const table = $(`
            <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
                <thead>
                    <tr style="background: rgba(0,0,0,0.3); font-weight: bold;">
                        <td style="padding: 6px;">#</td>
                        <td style="padding: 6px;">Çalışma Adı</td>
                        <td style="padding: 6px;">XP/Saat</td>
                        <td style="padding: 6px;">Para/Saat</td>
                        <td style="padding: 6px;">Enerji/Saat</td>
                        <td style="padding: 6px;">Verim Skoru</td>
                    </tr>
                </thead>
                <tbody></tbody>
            </table>
        `);

        results.forEach((r, index) => {
            const row = $(`
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <td style="padding: 6px;">${index + 1}</td>
                    <td style="padding: 6px;">${r.jobName}</td>
                    <td style="padding: 6px; color: #90EE90;">${r.xpPerHour}</td>
                    <td style="padding: 6px; color: #FFD700;">$${r.moneyPerHour}</td>
                    <td style="padding: 6px; color: #FF6B6B;">${r.energyPerHour}</td>
                    <td style="padding: 6px; font-weight: bold;">${r.efficiencyScore}</td>
                </tr>
            `);
            $('tbody', table).append(row);
        });

        scrollpane.appendContent(table);
        resultsDiv.empty().append($(scrollpane.getMainDiv()).css({ height: '250px' }));
    }
}