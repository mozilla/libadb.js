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

unload.when(function () {
  Devices.helperAddonInstalled = false;
  adb.close();
});

// start automatically start tracking devices
adb.start();

function onDeviceConnected(device) {
  console.log("ADBHELPER - CONNECTED: " + device);
  Devices.register(device, {
    connect: function () {
      let port = ConnectionManager.getFreeTCPPort();
      // let local = "tcp:" + port;
      let remote = "localfilesystem:/data/local/debugger-socket";
      return adb.forwardPort(port, remote)
                .then(() => port, console.error);
    }
  });
}

function onDeviceDisconnected(device) {
  console.log("ADBHELPER - DISCONNECTED: " + device);
  Devices.unregister(device);
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
