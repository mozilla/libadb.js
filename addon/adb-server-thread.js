/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Core code
 */
const URL_PREFIX = self.location.href.replace(/adb\-server\-thread\.js/, "");
const INSTANTIATOR_URL = URL_PREFIX + "ctypes-instantiator.js";
const EVENTED_CHROME_WORKER_URL = URL_PREFIX + "evented-chrome-worker.js";
const CONSOLE_URL = URL_PREFIX + "worker-console.js";
const ADB_TYPES = URL_PREFIX + "adb-types.js";
const JS_MESSAGE = URL_PREFIX + "js-message.js";
const COMMON_MESSAGE_HANDLER = URL_PREFIX + "common-message-handler.js";

importScripts(INSTANTIATOR_URL,
              EVENTED_CHROME_WORKER_URL,
              CONSOLE_URL,
              ADB_TYPES,
              JS_MESSAGE,
              COMMON_MESSAGE_HANDLER);

const worker = new EventedChromeWorker(null);
const console = new Console(worker);

let I = null;
let libadb = null;
let libPath_;

let jsMsgCallback = JsMsgType.ptr(CommonMessageHandler(worker, console, function(channel, args) {
  switch(channel) {
    case "device-update":
      let [updates] = JsMessage.unpack(args, ctypes.char.ptr);
      worker.emitAndForget("device-update", { msg: updates.readString() });
      return JsMessage.pack(0, Number);
    case "spawn-io-threads":
      let [ t_ptr ] = JsMessage.unpack(args, ctypes.void_t.ptr);
      console.debug("spawnIO was called from C, with voidPtr: " + t_ptr.toString());
      let t_ptrS = packPtr(t_ptr);
      worker.emitAndForget("spawn-io-threads", { t_ptrS: t_ptrS });
      return JsMessage.pack(0, Number);
    case "spawn-device-loop":
      console.debug("spawnD called from C");
      worker.emitAndForget("spawn-device-loop", {});
      return JsMessage.pack(0, Number);
    default:
      console.log("Unknown message: " + channel);
      return JsMessage.pack(-1, Number);
  }
}));

worker.once("init", function({ libPath }) {
  libPath_ = libPath;

  I = new Instantiator();

  libadb = ctypes.open(libPath);

  let array_lists_init =
      I.declare({ name: "array_lists_init",
                  returns: ctypes.void_t,
                  args: []
                }, libadb);
  array_lists_init();

  I.declare({ name: "main_server",
              returns: ctypes.int,
              // server_port
              args: [ struct_adb_main_input.ptr ]
            }, libadb);

  I.declare({ name: "socket_pipe",
              returns: ctypes.void_t,
              // the two ends of the pipe (sv)
              args: [ ctypes.ArrayType(ctypes.int, 2) ]
            }, libadb);

  let install_js_msg =
      I.declare({ name: "install_js_msg",
                  returns: ctypes.void_t,
                  args: [ JsMsgType.ptr ]
                }, libadb);

  install_js_msg(jsMsgCallback);
});

worker.once("start", function({ port, log_path }) {
  //let main = I.use("adb_main");
  let main = I.use("main_server");

  // struct adb_main_input
  let contents = {
    is_daemon: 0,
    server_port: port,
    is_lib_call: 1,
    log_path: ctypes.char.array()(log_path)
  };

  let onTrackReadyfn = function onTrackReady() {
    console.log("onTrackReady");
    worker.emitAndForget("track-ready", { });
  };

  contents.on_track_ready =
    ctypes.FunctionType(ctypes.default_abi, ctypes.void_t, []).ptr(onTrackReadyfn);

  let pipe = ctypes.ArrayType(ctypes.int, 2)();
  I.use("socket_pipe")(pipe);
  worker.emitAndForget("kill-server-fd", { fd: pipe[0] });

  contents.exit_fd = pipe[1];
  let input = struct_adb_main_input(contents);
  // NOTE: this will loop forever (until signal-ed)
  let x = main(input.address());
  return { ret: x };
});

worker.listen("cleanup", function() {
  console.debug("Cleaning up server-thread");
  if (libadb) {
    libadb.close();
  }
});

