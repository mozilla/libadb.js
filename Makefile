.PHONY: build clean adb run package test help

-include local.mk

SYS = $(shell uname -s)
ARCH = $(shell uname -m)
ifneq (,$(findstring MINGW32_,$(SYS)))
SYS = WINNT
endif

DOWNLOAD_CMD = wget -c

# The platform of the B2G build.
# Options include 'win32', 'mac64', 'linux64', and 'linux', and the default is
# the current platform.  The reliability of this option is unclear.  Setting it
# to 'mac64' on non-Mac is known to fail, because mozinstall doesn't know how to
# install from a DMG on a non-Mac platform.  But setting it to one of the Linux
# values on the other Linux platform works and is the main use case for it
# (i.e. to create the dual-binary Linux packages).
ifndef PLATFORM
  ifeq (WINNT, $(SYS))
    PLATFORM = win32
  else
  ifeq (Darwin, $(SYS))
    PLATFORM = mac64
  else
  ifeq (Linux, $(SYS))
    ifeq (x86_64, $(ARCH))
      PLATFORM = linux64
    else
      PLATFORM = linux
    endif
  endif
  endif
  endif
endif

LIBADB_VERSION = 0.4

# The location of libadb for making ADB. Set this variable to "local" to build 
# libadb.{so, dll} from source locally. Set to "remote" to grab prebuilt ADB 
# binaries from the FTP server.
LIBADB_LOCATION ?= remote

# This variable determines whether or not ADB is built with crypto support
# The values are "off" (crypto is disabled) or "dynamic" (crypto is enabled
# and linked dynamically) or "static" (crypto is enabled and linked statically 
# on linux)
ADB_AUTH ?= off
export ADB_AUTH

# Currently, all B2G builds are custom so we can optimize for code size and fix
# bugs in B2G or its nightly build environments (like 844047 and 815805).

# Platform-specific Defines
ifeq (win32, $(PLATFORM))
  ADB_PACKAGE = libadb-$(LIBADB_VERSION)-windows.zip
  DEPS = AdbWinApi.dll
  ADB_BINARIES = libadb.dll $(DEPS)
  LIB_SUFFIX = .dll

  ADB_OUT_DIR = android-tools/win-out
  ADB_DRIVERS_DIR = android-tools/adb-win-api
  ADB_LIBS = \
    $(ADB_OUT_DIR)/libadb$(LIB_SUFFIX) \
    $(ADB_OUT_DIR)/libtest$(LIB_SUFFIX) \
    $(ADB_DRIVERS_DIR)/api/objfre_wxp_x86/i386/AdbWinApi$(LIB_SUFFIX) \
    $(ADB_DRIVERS_DIR)/winusb/objfre_wxp_x86/i386/AdbWinUsbApi$(LIB_SUFFIX)
else
ifeq (mac64, $(PLATFORM))
  ADB_PACKAGE = libadb-$(LIBADB_VERSION)-mac.zip
  ADB_BINARIES = libadb.so
  LIB_SUFFIX = .so
  ADB_OUT_DIR = android-tools/adb-bin
  ADB_LIBS = \
    $(ADB_OUT_DIR)/libadb$(LIB_SUFFIX) \
    $(ADB_OUT_DIR)/libtest$(LIB_SUFFIX)

  DOWNLOAD_CMD = /usr/bin/curl -O
else
ifeq (linux64, $(PLATFORM))
  ADB_PACKAGE = libadb-$(LIBADB_VERSION)-linux64.zip
  ADB_BINARIES = libadb.so
  LIB_SUFFIX = .so
  ADB_OUT_DIR = android-tools/adb-bin
  ADB_LIBS = \
    $(ADB_OUT_DIR)/libadb$(LIB_SUFFIX) \
    $(ADB_OUT_DIR)/libtest$(LIB_SUFFIX)
else
ifeq (linux, $(PLATFORM))
  ADB_PACKAGE = libadb-$(LIBADB_VERSION)-linux.zip
  ADB_BINARIES = libadb.so
  LIB_SUFFIX = .so
  ADB_OUT_DIR = android-tools/adb-bin
  ADB_LIBS = \
    $(ADB_OUT_DIR)/libadb$(LIB_SUFFIX) \
    $(ADB_OUT_DIR)/libtest$(LIB_SUFFIX)
endif
endif
endif
endif

ADB_URL_BASE = https://ftp.mozilla.org/pub/mozilla.org/labs/r2d2b2g/
ADB_URL ?= $(ADB_URL_BASE)$(ADB_PACKAGE)

ifdef BIN
  BIN_ARG = -b $(BIN)
endif

ifdef PROFILE
  PROFILE_ARG = --profiledir $(PROFILE)
endif

ifdef TEST
  TEST_ARG = -f $(TEST)
endif

ADB_DATA_PATH = addon/data/$(PLATFORM)/adb

build: adb

clean:
	rm -rf addon/data/$(PLATFORM)
	rm -f $(ADB_PACKAGE)
	$(MAKE) -C android-tools clean

# We used to store the binaries in the PLATFORM/ directory, whereas
# now we store them in PLATFORM/adb/, which happens to be the same
# as the names of the executables on Mac and Linux; so we need to remove
# the executables from PLATFORM/ before creating PLATFORM/adb/.
#
# * prepare the adb folders
# * if the zip doesn't exist and either libadb is remote or we depend on
#   something from this zip (i.e. Windows)
#   Download the zip
# * if there exists a zip, unzip it
# * if we are installing locally, run the build command
adb:
	mkdir -p addon/data/$(PLATFORM)
	cd addon/data/$(PLATFORM) && rm -rf adb $(ADB_BINARIES)
	mkdir addon/data/$(PLATFORM)/adb
	if [ ! -f $(ADB_PACKAGE) ] && \
		 ( [ "$(LIBADB_LOCATION)" = "remote" ] || [ $(DEPS) ] ); then \
	  $(DOWNLOAD_CMD) $(ADB_URL); \
	fi;
	if [ -f $(ADB_PACKAGE) ]; then \
	  unzip $(ADB_PACKAGE) -d addon/data/$(PLATFORM)/adb; \
	fi;
	if [ "$(LIBADB_LOCATION)" = "local" ]; then \
	  $(MAKE) -C android-tools lib && \
	  $(MAKE) -C android-tools driver && \
	  cp $(ADB_LIBS) $(ADB_DATA_PATH); \
	fi;

run:
	mkdir -p helper/data/$(PLATFORM)/adb
	cp addon/data/$(PLATFORM)/adb/* helper/data/$(PLATFORM)/adb/
	cd addon-sdk && . bin/activate && cd ../helper && cfx run --package-path ../addon/ $(BIN_ARG) $(PROFILE_ARG)

package:
	cd addon-sdk && . bin/activate && cd ../addon && cfx xpi

test:
	cd addon-sdk && . bin/activate && cd ../addon && cfx test --verbose $(BIN_ARG) $(TEST_ARG) $(PROFILE_ARG)

help:
	@echo 'Targets:'
	@echo "  build: [default] build, download, install everything;\n"\
	"         combines the profile, b2g, and adb make targets"
	@echo '  clean: remove files created during the build process'
	@echo '  adb: download and install ADB libraries'
	@echo '  run: start Firefox with the addon installed into a new profile'
	@echo '  package: package the addon into a XPI'
	@echo '  test: run automated tests'
	@echo '  help: show this message'
