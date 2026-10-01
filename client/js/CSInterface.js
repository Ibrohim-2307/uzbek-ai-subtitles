/**
 * Adobe CSInterface v11.0.0
 * Adobe CEP panellari va ExtendScript o'rtasidagi rasmiy muloqot kutubxonasi.
 */

function CSInterface() {}

CSInterface.prototype.hostEnvironment = window.__adobe_cep__ ? JSON.parse(window.__adobe_cep__.getHostEnvironment()) : null;

CSInterface.prototype.getHostEnvironment = function () {
    return this.hostEnvironment;
};

CSInterface.prototype.closeExtension = function () {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.closeExtension();
    }
};

CSInterface.prototype.getSystemPath = function (pathType) {
    var path = "";
    var SystemPath = {
        USER_DATA: "userData",
        COMMON_FILES: "commonFiles",
        MY_DOCUMENTS: "myDocuments",
        APPLICATION: "application",
        EXTENSION: "extension",
        HOST_APPLICATION: "hostApplication"
    };

    if (window.__adobe_cep__) {
        path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
    }
    return path;
};

CSInterface.prototype.evalScript = function (script, callback) {
    if (window.__adobe_cep__) {
        if (!callback) {
            callback = function () {};
        }
        window.__adobe_cep__.evalScript(script, callback);
    } else {
        // Brauzerda test rejimida simulyatsiya
        console.log("[Brauzer Test] evalScript chaqirildi:", script);
        if (callback) {
            callback(JSON.stringify({ exists: false, testMode: true }));
        }
    }
};

CSInterface.prototype.addEventListener = function (type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.addEventListener(type, listener, obj);
    }
};

CSInterface.prototype.removeEventListener = function (type, listener, obj) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.removeEventListener(type, listener, obj);
    }
};

CSInterface.prototype.dispatchEvent = function (event) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.dispatchEvent(event);
    }
};

CSInterface.prototype.requestOpenExtension = function (extensionId, params) {
    if (window.__adobe_cep__) {
        window.__adobe_cep__.requestOpenExtension(extensionId, params);
    }
};

CSInterface.prototype.getExtensions = function (extensionIds) {
    var extensionIdsStr = JSON.stringify(extensionIds);
    var extensionsStr = "";
    if (window.__adobe_cep__) {
        extensionsStr = window.__adobe_cep__.getExtensions(extensionIdsStr);
    }
    return JSON.parse(extensionsStr);
};

CSInterface.prototype.getNetworkPreferences = function () {
    var result = "";
    if (window.__adobe_cep__) {
        result = window.__adobe_cep__.getNetworkPreferences();
    }
    return JSON.parse(result);
};

CSInterface.prototype.openURLInDefaultBrowser = function (url) {
    if (window.cep && window.cep.util) {
        window.cep.util.openURLInDefaultBrowser(url);
    } else {
        window.open(url, "_blank");
    }
};
