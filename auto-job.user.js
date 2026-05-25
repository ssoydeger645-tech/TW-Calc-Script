// ==UserScript==
// @name         TW Auto Job
// @version      1.6.0
// @description  Otomatik iş yapma - enerji kontrolü, zaman planlaması, log
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
        minEnergy: 20,
        restTime: 30,
        jobDuration: 3600,
        hotelSleepHours: 8,
        enabled: false,
        startHour: 8,
        stopHour: 23,
        useTimeLimit: false,
        jobs: [
            { id: null, count: 1 },
            { id: null, count: 1 },
        ],
    };

    let isWorking = false;
    let isSleeping = false;
    let currentJobIndex = 0;
    let currentJobDoneCount = 0;
    let logs = [];
    let timeLimitInterval = null;

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

    function getEnergyPercent() {
        return Math.round((window.Character.energy / window.Character.maxEnergy) * 100);
    }

    function addLog(msg) {
        const now = new Date();
        const time = now.getHours().toString().padStart(2,'0') + ':' + 
                     now.getMinutes().toString().padStart(2,'0') + ':' +
                     now.getSeconds().toString().padStart(2,'0');
        logs.unshift('[' + time + '] ' + msg);
        if (logs.length > 20) logs.pop();
        updateLog();
    }

    function updateLog() {
        const el = document.getElementById('aj-log');
        if (el) el.innerHTML = logs.join('<br>');
    }

    function depositMoney() {
        const money = window.Character.money;
        if (money <= 0) return;
        updateStatus('Bankaya para yatırılıyor... $' + money);
        addLog('Bankaya $' + money + ' yatırılıyor');
        window.Ajax.remoteCallMode('bank', 'deposit', {
            amount: money
        }, (data) => {
            if (data.error) {
                addLog('Banka hatası: ' + data.msg);
            } else {
                addLog('$' + money + ' bankaya yatırıldı!');
            }
        });
    }

    function goToHotel(reason) {
        if (isSleeping) return;
        isSleeping = true;
        reason = reason || 'Can düşük';
        updateStatus(reason + '! Bankaya para yatırılıyor...');
        addLog(reason + ' - Otele gidiliyor');
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
                    addLog('Otel hatası: ' + data.msg);
                    updateStatus('Otel hatası: ' + data.msg);
                } else {
                    addLog('Uyuyor... (' + CONFIG.hotelSleepHours + ' saat)');
                    updateStatus('Uyuyor... (' + CONFIG.hotelSleepHours + ' saat)');
                    setTimeout(() => {
                        isSleeping = false;
                        addLog('Uyku bitti, devam ediyor');
                        if (CONFIG.enabled) startJob();
                    }, CONFIG.hotelSleepHours * 3600 * 1000);
                }
            });
        }, 2000);
    }

    function isInTimeRange() {
        if (!CONFIG.useTimeLimit) return true;
        const hour = new Date().getHours();
        if (CONFIG.startHour <= CONFIG.stopHour) {
            return hour >= CONFIG.startHour && hour < CONFIG.stopHour;
        }
        return hour >= CONFIG.startHour || hour < CONFIG.stopHour;
    }

    function startTimeLimitChecker() {
        if (timeLimitInterval) clearInterval(timeLimitInterval);
        timeLimitInterval = setInterval(() => {
            if (!CONFIG.enabled) return;
            if (!isInTimeRange() && !isWorking && !isSleeping) {
                addLog('Zaman sınırı dışı, bekleniyor...');
                updateStatus('Zaman dışı, bekleniyor...');
            }
        }, 60000);
    }

    function getNextJob() {
        const activeJobs = CONFIG.jobs.filter(j => j.id !== null);
        if (!activeJobs.length) return null;

        while (currentJobIndex < CONFIG.jobs.length && CONFIG.jobs[currentJobIndex].id === null) {
            currentJobIndex++;
        }

        if (currentJobIndex >= CONFIG.jobs.length) return null;
        return CONFIG.jobs[currentJobIndex];
    }

    function onJobComplete() {
        currentJobDoneCount++;
        const job = CONFIG.jobs[currentJobIndex];

        if (currentJobDoneCount >= job.count) {
            currentJobDoneCount = 0;
            currentJobIndex++;

            while (currentJobIndex < CONFIG.jobs.length && CONFIG.jobs[currentJobIndex].id === null) {
                currentJobIndex++;
            }
        }

        if (currentJobIndex >= CONFIG.jobs.length) {
            CONFIG.enabled = false;
            isWorking = false;
            const btn = document.getElementById('aj-toggle');
            if (btn) {
                btn.textContent = '▶ Başlat';
                btn.style.background = '#2a6000';
                btn.style.borderColor = '#4a8000';
            }
            addLog('✅ Tüm çalışmalar tamamlandı!');
            updateStatus('✅ Tüm çalışmalar tamamlandı!');
            return false;
        }

        return true;
    }

    function waitForIdle(callback) {
        const check = setInterval(() => {
            try {
                const queue = window.TaskQueue.queue;
                if (!queue || queue.length === 0) {
                    clearInterval(check);
                    callback();
                }
            } catch (e) {
                clearInterval(check);
                callback();
            }
        }, 3000);
    }

    function startJob() {
        if (!CONFIG.enabled || isWorking || isSleeping) return;

        // Zaman kontrolü
        if (!isInTimeRange()) {
            updateStatus('Zaman dışı, bekleniyor...');
            setTimeout(() => {
                if (CONFIG.enabled) startJob();
            }, 60000);
            return;
        }

        // Can kontrolü
        if (getHealthPercent() < CONFIG.minHealth) {
            goToHotel('Can düşük (%' + getHealthPercent() + ')');
            return;
        }

        // Enerji kontrolü
        if (getEnergyPercent() < CONFIG.minEnergy) {
            addLog('Enerji düşük (%' + getEnergyPercent() + '), bekleniyor...');
            updateStatus('Enerji düşük, bekleniyor...');
            setTimeout(() => {
                if (CONFIG.enabled) startJob();
            }, 5 * 60 * 1000);
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
            const statusMsg = job.name + ' (' + (currentJobDoneCount + 1) + '/' + jobConfig.count + ')';
            updateStatus('Çalışılıyor: ' + statusMsg);
            addLog('Başladı: ' + statusMsg);

            const task = new window.TaskJob(job.id, nearest[0], nearest[1], CONFIG.jobDuration);
            window.TaskQueue.add(task);

            waitForIdle(() => {
                isWorking = false;
                addLog('Bitti: ' + job.name);

                const shouldContinue = onJobComplete();
                if (!shouldContinue) return;
                if (!CONFIG.enabled) return;

                updateStatus('Dinleniyor... (' + CONFIG.restTime + ' sn)');
                setTimeout(() => {
                    if (CONFIG.enabled) startJob();
                }, CONFIG.restTime * 1000);
            });
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
                <label style="color: #FFD700; font-weight: bold;">Çalışma ${i+1}:</label>
                <select id="aj-job-${i}" style="
                    width: 100%;
                    background: #2a1400;
                    color: #FFD700;
                    border: 1px solid #8B6914;
                    padding: 3px;
                    font-size: 11px;
                    margin: 3px 0;
                ">${jobOptions}</select>
                <label style="color: #ccc;">Tekrar:</label>
                <input id="aj-count-${i}" type="number" value="1" min="1" max="999"
                    style="width: 60px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                <span style="color: #aaa; font-size: 10px;"> kere</span>
            </div>
        `).join('');

        const panel = document.createElement('div');
        panel.id = 'tw-auto-job-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 10px;
            width: 270px;
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
            ">🤠 TW Auto Job v1.6</div>

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
                        style="width: 45px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    <label style="color: #ccc; margin-left: 8px;">Min. Enerji %:</label>
                    <input id="aj-min-energy" type="number" value="20" min="5" max="90"
                        style="width: 45px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Dinlenme (sn):</label>
                    <input id="aj-rest-time" type="number" value="30" min="5" max="3600"
                        style="width: 55px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 6px;">
                    <label style="color: #ccc;">Uyku (saat):</label>
                    <input id="aj-sleep-hours" type="number" value="8" min="1" max="12"
                        style="width: 45px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                </div>

                <div style="margin-bottom: 6px; padding: 5px; background: rgba(0,0,0,0.2); border-radius: 4px;">
                    <label style="color: #FFD700;">⏰ Zaman Planlaması:</label>
                    <div style="margin-top: 4px;">
                        <input type="checkbox" id="aj-use-time">
                        <label style="color: #ccc; margin-left: 4px;">Aktif et</label>
                    </div>
                    <div style="margin-top: 4px;">
                        <label style="color: #ccc;">Başlangıç:</label>
                        <input id="aj-start-hour" type="number" value="8" min="0" max="23"
                            style="width: 40px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                        <label style="color: #ccc; margin-left: 8px;">Bitiş:</label>
                        <input id="aj-stop-hour" type="number" value="23" min="0" max="23"
                            style="width: 40px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    </div>
                </div>

                <div id="aj-status" style="margin-bottom: 4px; color: #aaa; text-align: center; font-size: 11px;">
                    Bekleniyor...
                </div>

                <div id="aj-log" style="
                    margin-bottom: 8px;
                    padding: 4px;
                    background: rgba(0,0,0,0.3);
                    border-radius: 4px;
                    font-size: 10px;
                    color: #aaa;
                    max-height: 80px;
                    overflow-y: auto;
                    line-height: 1.4;
                "></div>

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
        CONFIG.minEnergy = parseInt(document.getElementById('aj-min-energy').value);
        CONFIG.restTime = parseInt(document.getElementById('aj-rest-time').value);
        CONFIG.jobDuration = parseInt(document.getElementById('aj-duration').value);
        CONFIG.hotelSleepHours = parseInt(document.getElementById('aj-sleep-hours').value);
        CONFIG.useTimeLimit = document.getElementById('aj-use-time').checked;
        CONFIG.startHour = parseInt(document.getElementById('aj-start-hour').value);
        CONFIG.stopHour = parseInt(document.getElementById('aj-stop-hour').value);
        CONFIG.enabled = !CONFIG.enabled;

        currentJobIndex = 0;
        currentJobDoneCount = 0;

        const btn = document.getElementById('aj-toggle');
        if (CONFIG.enabled) {
            btn.textContent = '⏹ Durdur';
            btn.style.background = '#600000';
            btn.style.borderColor = '#800000';
            startTimeLimitChecker();
            addLog('Otomasyon başlatıldı');
            startJob();
        } else {
            btn.textContent = '▶ Başlat';
            btn.style.background = '#2a6000';
            btn.style.borderColor = '#4a8000';
            isWorking = false;
            if (timeLimitInterval) clearInterval(timeLimitInterval);
            addLog('Otomasyon durduruldu');
            updateStatus('Durduruldu.');
        }
    }

    function updateStatus(msg) {
        const el = document.getElementById('aj-status');
        if (el) el.textContent = msg;
    }

})();
