package main

import (
	"fmt"
	"os"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/alert"
)

func main() {
	for _, a := range os.Args[1:] {
		if a == "--self-test" {
			alert.SelfTest()
			return
		}
	}
	if err := alert.Serve(alert.DefaultConfig()); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
