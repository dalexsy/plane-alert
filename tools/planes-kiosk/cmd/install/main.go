package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/install"
	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/ufw"
)

func main() {
	selfTest := false
	launch := false
	for _, a := range os.Args[1:] {
		switch a {
		case "--self-test":
			selfTest = true
		case "--launch":
			launch = true
		}
	}
	_ = flag.CommandLine
	if selfTest {
		runSelfTest()
		return
	}
	if err := install.Run(launch); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func runSelfTest() {
	live := "[21] 8796/tcp ALLOW IN 192.168.178.79 # planes-kiosk-alert from dryl-prod"
	del, add := ufw.Plan(live, ufw.KnownProdIP, ufw.AlertPort)
	if len(del) != 0 || add {
		panic("locked plan")
	}
	wide := "[ 8] 8796/tcp ALLOW IN Anywhere\n[ 9] 8796/tcp ALLOW IN Anywhere (v6)\n"
	del, add = ufw.Plan(wide, ufw.KnownProdIP, ufw.AlertPort)
	if len(del) != 2 || !add {
		panic("wide plan")
	}
	fmt.Println("[ok] planes kiosk ufw persist self-test")
}
