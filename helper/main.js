console.log("A");
let {Cu, Ci} = require("chrome");
let adb = require("adb");
const events = require("sdk/event/core");
console.log("B");

const {devtools} = Cu.import("resource://gre/modules/devtools/Loader.jsm", {});
console.log("B1");
const devtoolsRequire = devtools.require;
const {ConnectionManager} = devtoolsRequire("devtools/client/connection-manager");
console.log("B2");
let {Devices} = Cu.import("resource://gre/modules/devtools/Devices.jsm");
console.log("C");

Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");

Devices.helperAddonInstalled = true;
exports.shutdown = function() {
  Devices.helperAddonInstalled = false;
  adb.kill(true);
}
console.log("D");
// start automatically start tracking devices
adb.start();
console.log("E");

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
    console.log("simulator.observe: " + topic);
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
