package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/session"
)

func main() {
	verifyOnly := flag.Bool("verify-only", false, "exit 0 when planes HTML is reachable")
	flag.Parse()
	p := session.DefaultPaths()
	if *verifyOnly {
		if err := session.VerifyOnly(p); err != nil {
			os.Exit(1)
		}
		return
	}
	if err := session.Bootstrap(p); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
