// ==UserScript==
// @name         TW Auto Job
// @version      1.0.0
// @description  Otomatik iş yapma ve gümüş çalışma sıralaması
// @author       ssoydeger645-tech
// @include      https://*.the-west.*/game.php*
// @include      https://*.the-west.com.*/game.php*
// @include      https://*.the-west.*.com/game.php*
// @include      https://*.tw.innogames.*/game.php*
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // Ayarlar
    const CONFIG = {
        minHealth: 30, // Minimum can % (altına inince otele git)
        restTime: 5 * 60 * 1000, // Her çalışma arasında dinlenme (5 dakika)
        jobDuration: 3600, // Çalışma süresi (saniye): 15, 600, 3600
        hotelSleepHours: 8, // Otelde uyku süresi (saat)
        enabled: false, // Başlangıçta kapalı
    };

    let autoJobInterval = null;
    let isWorking = false;
    let isSleeping = false;

    // Oyun hazır olana kadar bekle
    const waitForGame = setInterval(() => {
        if (typeof window.west === 'undefined' || typeof window.Character === 'undefined') return;
        clearInterval(waitForGame);
        init();
    }, 1000);

    function init() {
        console.log('[TW Auto Job] Başlatıldı!');
        createUI();
    }

    // Gümüş çalışmaları al ve sırala
    function getSilverJobs() {
        const jobs = window.JobList.getSortedJobs('id');
        return jobs.filter(job => {
            // Seviye kontrolü
            if (job.level > window.Character.level) return false;
            return true;
        });
    }

    // Can puanı kontrolü
    function getHealthPercent() {
        const health = window.Character.health;
        const maxHealth = window.Character.maxHealth;
        return Math.round((health / maxHealth) * 100);
    }

    // Otele git ve uyu
    function goToHotel() {
        if (isSleeping) return;
        isSleeping = true;
        console.log('[TW Auto Job] Can düşük, otele gidiliyor...');
        updateStatus('Can düşük! Otele gidiliyor...');

        // Oteli bul ve uyu
        const town = window.Character.homeTown;
        if (!town) {
            console.log('[TW Auto Job] Kasaba bulunamadı!');
            return;
        }

        window.Ajax.remoteCallMode(
            'hotel',
            'sleep',
            {
                town_id: town.town_id,
                time: CONFIG.hotelSleepHours,
            },
            data => {
                if (data.error) {
                    console.log('[TW Auto Job] Otel hatası:', data.msg);
                    isSleeping = false;
                } else {
                    console.log('[TW Auto Job] Uyuyor...');
                    updateStatus(`Uyuyor... (${CONFIG.hotelSleepHours} saat)`);
                    setTimeout(() => {
                        isSleeping = false;
                        updateStatus('Uyku bitti, devam ediyor...');
                    }, CONFIG.hotelSleepHours * 3600 * 1000);
                }
            },
        );
    }

    // En iyi işi bul ve başlat
    function startBestJob() {
        if (!CONFIG.enabled || isWorking || isSleeping) return;

        // Can kontrolü
        const healthPercent = getHealthPercent();
        if (healthPercent < CONFIG.minHealth) {
            goToHotel();
            return;
        }

        const jobs = getSilverJobs();
        if (!jobs.length) {
            console.log('[TW Auto Job] Uygun iş bulunamadı!');
            return;
        }

        // Minimap verisi al
        window.Ajax.get('map', 'get_minimap', {}, minimap => {
            const pos = window.Character.position;
            let bestJob = null;
            let bestCoord = null;

            for (const job of jobs) {
                const group = minimap.job_groups[job.groupid];
                if (!group || !group.length) continue;

                const nearest = group
                    .slice()
                    .sort(
                        (a, b) =>
                            Math.abs(a[0] - pos.x) +
                            Math.abs(a[1] - pos.y) -
                            (Math.abs(b[0] - pos.x) + Math.abs(b[1] - pos.y)),
                    )[0];

                bestJob = job;
                bestCoord = nearest;
                break;
            }

            if (!bestJob || !bestCoord) {
                console.log('[TW Auto Job] İş konumu bulunamadı!');
                return;
            }

            isWorking = true;
            updateStatus(`Çalışılıyor: ${bestJob.name}`);
            console.log(`[TW Auto Job] Başlatılıyor: ${bestJob.name}`);

            // İşi başlat
            const task = new window.TaskJob(bestJob.id, bestCoord[0], bestCoord[1], CONFIG.jobDuration);
            window.TaskQueue.add(task);

            // Çalışma bitince dinlen
            setTimeout(() => {
                isWorking = false;
                updateStatus(`Dinleniyor... (${CONFIG.restTime / 60000} dakika)`);
                setTimeout(() => {
                    if (CONFIG.enabled) startBestJob();
                }, CONFIG.restTime);
            }, (CONFIG.jobDuration + 30) * 1000);
        });
    }

    // UI oluştur
    function createUI() {
        const panel = document.createElement('div');
        panel.id = 'tw-auto-job-panel';
        panel.style.cssText = `
            position: fixed;
            bottom: 120px;
            right: 10px;
            width: 220px;
            background: rgba(50, 25, 0, 0.95);
            border: 2px solid #8B6914;
            border-radius: 8px;
            padding: 10px;
            z-index: 9999;
            color: #FFD700;
            font-family: Georgia, serif;
            font-size: 12px;
        `;

        panel.innerHTML = `
            <div style="font-weight: bold; font-size: 14px; margin-bottom: 8px; text-align: center; color: #FFD700;">
                🤠 TW Auto Job
            </div>
            
            <div style="margin-bottom: 6px;">
                <label style="color: #ccc;">Min. Can %:</label>
                <input id="aj-min-health" type="number" value="${CONFIG.minHealth}" min="10" max="90"
                    style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
            </div>
            
            <div style="margin-bottom: 6px;">
                <label style="color: #ccc;">Dinlenme (dk):</label>
                <input id="aj-rest-time" type="number" value="${CONFIG.restTime / 60000}" min="1" max="60"
                    style="width: 50px; margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
            </div>

            <div style="margin-bottom: 6px;">
                <label style="color: #ccc;">Süre:</label>
                <select id="aj-duration" style="margin-left: 5px; background: #2a1400; color: #FFD700; border: 1px solid #8B6914; padding: 2px;">
                    <option value="15">15 saniye</option>
                    <option value="600">10 dakika</option>
                    <option value="3600" selected>1 saat</option>
                </select>
            </div>

            <div style="margin-bottom: 10px;">
                <label style="color: #ccc;">Uyku (saat):</label>
                <input id="aj-sleep-hours" type="number" value="${CONFIG.hotelSleepHours}" min="1" max="12"
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
        `;

        document.body.appendChild(panel);

        // Buton olayları
        document.getElementById('aj-toggle').addEventListener('click', toggleAutoJob);
        document.getElementById('aj-close').addEventListener('click', () => {
            panel.style.display = 'none';
        });
    }

    function toggleAutoJob() {
        CONFIG.enabled = !CONFIG.enabled;
        CONFIG.minHealth = parseInt(document.getElementById('aj-min-health').value);
        CONFIG.restTime = parseInt(document.getElementById('aj-rest-time').value) * 60000;
        CONFIG.jobDuration = parseInt(document.getElementById('aj-duration').value);
        CONFIG.hotelSleepHours = parseInt(document.getElementById('aj-sleep-hours').value);

        const btn = document.getElementById('aj-toggle');

        if (CONFIG.enabled) {
            btn.textContent = '⏹ Durdur';
            btn.style.background = '#600000';
            btn.style.borderColor = '#800000';
            updateStatus('Başlatıldı!');
            startBestJob();
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
