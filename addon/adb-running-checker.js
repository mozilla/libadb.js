/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Uses host:version service to detect if ADB is running
 * Modified from adb-file-transfer from original ADB
 */

'use strict';

const { Cu, Cc, Ci } = require("chrome");

const promise = require("sdk/core/promise");
const client = require("adb/adb-client");

function debug() {
  console.debug.apply(console, ["ADB: "].concat(Array.prototype.slice.call(arguments, 0)));
}

exports.check = () => {
  return request("version").then(response => {
    // TODO: Actually check the version number to make sure the daemon
    //       supports the commands we want to use
    return response && response.indexOf("001f") != -1;
  });
};

exports.kill = () => request("kill");

function request(type) {
  let deferred = promise.defer();
  let socket;
  let state;

  debug("Asking for host:" + type);

  let runFSM = function runFSM(aData) {
    debug("runFSM " + state);
    switch(state) {
      case "start":
        let req = client.createRequest("host:" + type);
        socket.send(req);
        state = "wait-reply";
        break;
      case "wait-reply":
        let { length, data } = client.unpackPacket(aData);
        debug("length: ", length, "data: ", data);
        socket.close();
        deferred.resolve(data);
        break;
      default:
        debug("Unexpected State: " + state);
        socket.close();
        deferred.resolve(false);
    }
  };

  let setupSocket = function() {
    socket.s.onerror = function(aEvent) {
      debug("running checker onerror");
      deferred.resolve(false);
    };

    socket.s.onopen = function(aEvent) {
      debug("running checker onopen");
      state = "start";
      runFSM();
    }

    socket.s.onclose = function(aEvent) {
      debug("running checker onclose");
    };

    socket.s.ondata = function(aEvent) {
      debug("running checker ondata");
      runFSM(aEvent.data);
    };
  };

  socket = client.connect();
  setupSocket();

  return deferred.promise;
};
