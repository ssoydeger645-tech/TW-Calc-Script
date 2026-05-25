// ==UserScript==
// @name         TW Auto Job
// @version      1.4.0
// @description  Otomatik iş yapma - 2 çalışma, tekrar sayısı
// @author       ssoydeger645-tech
// @include      https://*.the-west.*/game.php*
// @include      https://*.the-west.com.*/game.php*
// @include      https://*.the-west.*.com/game.php*
// @include      https://*.tw.innogames.*/game.php*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const CONFIG = {
        minHealth: 30,
        restTime: 30,
        jobDuration: 3600,
        hotelSleepHours: 8,
        enabled: false,
        jobs: [
            { id: null, count: 1 },
            { id: null, count: 1 },
        ],
    };

    let isWorking = false;
    let isSleeping = false;
    let currentJobIndex = 0;
    let currentJobDoneCount = 0;

    const waitForGame = setInterval(() => {
        if (typeof window.west === 'undefined' || typeof window.Character === 'undefined') return;
        clearInterval(waitForGame);
        init();
    }, 1000);

    function init() {
        createUI();
    }

    function getHealthPercent() {
        return Math.round((window.Character.health / window.Character.maxHealth) * 100);
    }

    function depositMoney() {
        const money = window.Character.money;
        if (money <= 0) return;
        updateStatus('Bankaya para yatırılıyor... $' + money);
        window.Ajax.remoteCallMode('bank', 'deposit', {
            amount: money
        }, (data) => {
            if (data.error) {
                updateStatus('Banka hatası: ' + data.msg);
            } else {
                updateStatus('$' + money + ' bankaya yatırıldı!');
            }
        });
    }

    function goToHotel() {
        if (isSleeping) return;
        isSleeping = true;
        updateStatus('Can düşük! Bankaya para yatırılıyor...');
        depositMoney();
        setTimeout(() => {
            const town = window.Character.homeTown;
            if (!town) { isSleeping = false; return; }
            updateStatus('Otele gidiliyor...');
            window.Ajax.remoteCallMode('hotel', 'sleep', {
                town_id: town.town_id,
                time: CONFIG.hotelSleepHours
            }, (data) => {
                if (data.error) {
                    isSleeping = false;
                    updateStatus('Otel hatası: ' + data.msg);
                } else {
                    updateStatus('Uyuyor... (' + CONFIG.hotelSleepHours + ' saat)');
                    setTimeout(() => {
                        isSleeping = false;
                        if (CONFIG.enabled) startJob();
                    }, CONFIG.hotelSleepHours * 3600 * 1000);
                }
            });
        }, 2000);
    }

    function getNextJob() {
        const activeJobs = CONFIG.jobs.filter(j => j.id !== null);
        if (!activeJobs.length) return null;

        const job = CONFIG.jobs[currentJobIndex];
        if (!job || job.id === null) {
            currentJobIndex = 0;
            currentJobDoneCount = 0;
            return getNextJob();
        }

        currentJobDoneCount++;
        if (currentJobDoneCount >= job.count) {
            currentJobDoneCount = 0;
            currentJobIndex = (currentJobIndex + 1) % CONFIG.jobs.length;
            // Boş slotları atla
            let tries = 0;
            while (CONFIG.jobs[currentJobIndex].id === null && tries < CONFIG.jobs.length) {
                currentJobIndex = (currentJobIndex + 1) % CONFIG.jobs.length;
                tries++;
            }
        }

        return job;
    }

    function startJob() {
        if (!CONFIG.enabled || isWorking || isSleeping) return;

        if (getHealthPercent() < CONFIG.minHealth) {
            goToHotel();
            return;
        }

        const jobConfig = getNextJob();
        if (!jobConfig || !jobConfig.id) {
            updateStatus('Lütfen en az bir çalışma seçin!');
            return;
        }

        const job = window.JobList.getJobById(jobConfig.id);
        if (!job) { updateStatus('Çalışma bulunamadı!'); return; }

        window.Ajax.get('map', 'get_minimap', {}, (minimap) => {
            const pos = window.Character.position;
            const group = minimap.job_groups[job.groupid];
            if (!group || !group.length) {
                updateStatus('Çalışma konumu bulunamadı!');
                return;
            }

            const nearest = group.slice().sort((a, b) =>
                Math.abs(a[0] - pos.x) + Math.abs(a[1] - pos.y) -
                (Math.abs(b[0] - pos.x) + Math.abs(b[1] - pos.y))
            )[0];

            isWorking = true;
            updateStatus('Çalışılıyor: ' + job.name + ' (' + currentJobDoneCount + '/' + jobConfig.count + ')');

            const task = new window.TaskJob(job.id, nearest[0], nearest[1], CONFIG.jobDuration);
            window.TaskQueue.add(task);

            setTimeout(() => {
                isWorking = false;
                updateStatus('Dinleniyor... (' + CONFIG.restTime + ' sn)');
                setTimeout(() => {
                    if (CONFIG.enabled) startJob();
                }, CONFIG.restTime * 1000);
            }, (CONFIG.jobDuration + 10) * 1000);
        });
    }

    function createUI() {
        const jobs = window.JobList.getSortedJobs('id');

        let jobOptions = '<option value="">-- Seç --</option>';
        jobs.forEach(j => {
            jobOptions += `<option value="${j.id}">${j.name} (Sv.${j.level})</option>`;
        });

        const jobSelects = [0, 1].map(i => `
            <div style="margin-bottom: 8px; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                <div style="margin-bottom: 3px;">
                    <label style="color: #FFD700; font-weight: bold;">Çalışma ${i+1}:</label>
                </div>
                <select id="aj-job-${i}" style="
                    width: 100%;
                    background: #2a1400;
                    color: #FFD700;
                    border: 1px solid #8B6914;
                    padding: 3px;
                    font-size: 11px;
                    margin-bottom: 4px;
                ">${jobOptions}</select>
                <div>
                    <label style="color: #ccc;">Tekrar:</label>
                    <input id="aj-count-${i}" type="number" value="1" min="1" max="999"
                        style="width: 60px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    <span style="color: #aaa; font-size: 10px;"> kere</span>
                </div>
            </div>
        `).join('');

        const panel = document.createElement('div');
        panel.id = 'tw-auto-job-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 10px;
            width: 260px;
            background: rgba(50, 25, 0, 0.95);
            border: 2px solid #8B6914;
            border-radius: 8px;
            z-index: 9999;
            color: #FFD700;
            font-family: Georgia, serif;
            font-size: 12px;
            user-select: none;
        `;

        panel.innerHTML = `
            <div id="aj-header" style="
                background: rgba(100,50,0,0.8);
                padding: 8px 10px;
                border-radius: 6px 6px 0 0;
                cursor: move;
                font-weight: bold;
                font-size: 14px;
                text-align: center;
                color: #FFD700;
            ">🤠 TW Auto Job</div>

            <div style="padding: 10px;">
                ${jobSelects}

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Süre:</label>
                    <select id="aj-duration" style="margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                        <option value="15">15 saniye</option>
                        <option value="600">10 dakika</option>
                        <option value="3600" selected>1 saat</option>
                    </select>
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Min. Can %:</label>
                    <input id="aj-min-health" type="number" value="30" min="10" max="90"
                        style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Dinlenme (sn):</label>
                    <input id="aj-rest-time" type="number" value="30" min="5" max="3600"
                        style="width: 60px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 10px;">
                    <label style="color: #ccc;">Uyku (saat):</label>
                    <input id="aj-sleep-hours" type="number" value="8" min="1" max="12"
                        style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div id="aj-status" style="margin-bottom: 8px; color: #aaa; text-align: center; font-size: 11px;">
                    Bekleniyor...
                </div>

                <div style="text-align: center;">
                    <button id="aj-toggle" style="
                        background: #2a6000;
                        color: #fff;
                        border: 1px solid #4a8000;
                        padding: 5px 15px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                        margin-right: 5px;
                    ">▶ Başlat</button>
                    <button id="aj-close" style="
                        background: #600000;
                        color: #fff;
                        border: 1px solid #800000;
                        padding: 5px 10px;
                        border-radius: 4px;
                        cursor: pointer;
                        font-size: 13px;
                    ">✕</button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);
        makeDraggable(panel, document.getElementById('aj-header'));
        document.getElementById('aj-toggle').addEventListener('click', toggleAutoJob);
        document.getElementById('aj-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }

    function makeDraggable(el, handle) {
        let startX, startY, startLeft, startTop;
        handle.addEventListener('mousedown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
            startLeft = el.offsetLeft;
            startTop = el.offsetTop;
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        function onMove(e) {
            el.style.left = (startLeft + e.clientX - startX) + 'px';
            el.style.top = (startTop + e.clientY - startY) + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
    }

    function toggleAutoJob() {
        CONFIG.jobs = [0, 1].map(i => ({
            id: parseInt(document.getElementById('aj-job-' + i).value) || null,
            count: parseInt(document.getElementById('aj-count-' + i).value) || 1,
        }));
        CONFIG.minHealth = parseInt(document.getElementById('aj-min-health').value);
        CONFIG.restTime = parseInt(document.getElementById('aj-rest-time').value);
        CONFIG.jobDuration = parseInt(document.getElementById('aj-duration').value);
        CONFIG.hotelSleepHours = parseInt(document.getElementById('aj-sleep-hours').value);
        CONFIG.enabled = !CONFIG.enabled;
        currentJobIndex = 0;
        currentJobDoneCount = 0;

        const btn = document.getElementById('aj-toggle');
        if (CONFIG.enabled) {
            btn.textContent = '⏹ Durdur';
            btn.style.background = '#600000';
            btn.style.borderColor = '#800000';
            startJob();
        } else {
            btn.textContent = '▶ Başlat';
            btn.style.background = '#2a6000';
            btn.style.borderColor = '#4a8000';
            isWorking = false;
            updateStatus('Durduruldu.');
        }
    }

    function updateStatus(msg) {
        const el = document.getElementById('aj-status');
        if (el) el.textContent = msg;
    }

})();
