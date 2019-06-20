Note: this project has been archived, as development has stalled, and it isn't being actively maintained, nor used.

# libadb.js

## Building

Using a precompiled libadb:

    $ make

Compiling locally:

    $ make LIBADB_LOCATION=local

## Running

    $ make run BIN=<PATH TO FIREFOX BINARY>

## Testing

    $ make test BIN=<PATH TO FIREFOX BINARY>

## Debugging

### Logging

Use the environment variable ADB_TRACE with flags defined in adb_trace_init()
in adb.cpp e.g. `ADB_TRACE=all`.

### Attaching A Debugger

Add `--no-run` as an argument to `cfx` in the run target in the makefile.
This will then dump the command to run Firefox when `make run` is used.

Start lldb/gdb

    $ lldb -- <COMMAND FROM ABOVE>

## About the JS side libadb.js

*Main* (adb.js) - Starts and shuts down all the various workers below.
Also, responsible for forwarding events on.

*Server* (adb-server-thread.js) - The worker is mainly responsible for
initialization and receiving messages such as when a device status changes
or starting the IO threads when a device is connected to. It loops forever
until the kill server file descriptor is written to, which happens
on the main thread.

*Device Poll* (adb-device-poll-thread.js) - This thread is only responsible for
starting a polling loop that looks for new device connections (not on Linux,
Linux uses pthreads). The C code does not send message directly back to this
thread when devices are connected, it instead will send an event to the server
thread. It is terminated when kill_device_loop is called.

*File Descriptor IO* (adb-io-thread.js) - Used for reading and writing to file
descriptors.

*Utility* (adb-utility-thread.js) - Currently only used for queries where you
ask ADB for a service and it will return a file descriptor to communicate with
that service e.g. shell or port forwarding (See SERVICES.TXT).

*Device Input & Output* (adb-io-thread-spawner.js) - These workers are used as
an IO pump reading and writing data to a device. They share the same code.

## More Information

https://github.com/mozilla/r2d2b2g/pull/663

- android-tools/adb-bin/OVERVIEW.txt
- android-tools/adb-bin/protocol.txt
- android-tools/adb-bin/SERVICES.txt
