package main

import (
	"fmt"
	"os"

	"github.com/dalexsy/plane-alert/tools/planes-kiosk/internal/install"
)

func main() {
	if err := install.Restart(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
