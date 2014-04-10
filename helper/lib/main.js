let {Cu, Ci} = require("chrome");
let adb = require("adb");
const events = require("sdk/event/core");
const unload = require('sdk/system/unload');

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
const devtoolsRequire = devtools.require;
const {ConnectionManager} = devtoolsRequire("devtools/client/connection-manager");
let {Devices} = Cu.import("resource://gre/modules/devtools/Devices.jsm");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Devices.helperAddonInstalled = true;

// start automatically start tracking devices
adb.start();

// Ensure devices list is up to date, restarting the server if needed
function refresh() {
  if (!adb.ready) {
    adb.restart();
  }
}

Devices.on("refresh", refresh);

unload.when(function () {
  Devices.off("refresh", refresh);
  Devices.helperAddonInstalled = false;
  adb.close();
});

let idToName = new Map();

function onDeviceConnected(id) {
  console.log("ADBHELPER - CONNECTED: " + id);
  adb.getDeviceName().then(name => {
    name = name.trim();
    console.log("DEVICE NAME: " + name);
    name = name || id; // Some devices might not have a pretty name
    idToName.set(id, name);
    Devices.register(name, {
      connect: function () {
        let port = ConnectionManager.getFreeTCPPort();
        // let local = "tcp:" + port;
        let remote = "localfilesystem:/data/local/debugger-socket";
        return adb.forwardPort(port, remote)
                  .then(() => port, console.error);
      }
    });
  });
}

function onDeviceDisconnected(id) {
  console.log("ADBHELPER - DISCONNECTED: " + id);
  let name = idToName.get(id);
  Devices.unregister(name);
  idToName.delete(id);
}

let observer = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver,
                                         Ci.nsISupportsWeakReference]),
  observe: function observe(subject, topic, data) {
    switch (topic) {
      case "adb-ready":
        console.log("adb-ready");
        break;
      case "adb-device-connected":
        console.log("adb-device-connected");
        onDeviceConnected(data);
        break;
      case "adb-device-disconnected":
        console.log("adb-device-disconnected");
        onDeviceDisconnected(data);
        break;
      case "adb-port-in-use":
        console.log("adb-port-in-use");
        break;
    }
  }
};

Services.obs.addObserver(observer, "adb-ready", true);
Services.obs.addObserver(observer, "adb-device-connected", true);
Services.obs.addObserver(observer, "adb-device-disconnected", true);
Services.obs.addObserver(observer, "adb-port-in-use", true);
