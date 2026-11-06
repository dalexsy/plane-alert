package main

import (
	"context"
	"dryl-planes/internal/antenna"
	"dryl-planes/internal/api"
	"flag"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"syscall"
	"time"
)

var revision = "development"

func main() {
	root := flag.String("data", "/home/pi/planes-api/data", "existing Plane Alert data directory")
	listen := flag.String("listen", "127.0.0.1:8795", "loopback listener")
	version := flag.Bool("version", false, "print revision")
	check := flag.Bool("check-data", false, "validate existing stores without network or writes")
	flag.Parse()
	if *version {
		fmt.Println(revision)
		return
	}
	host, _, err := net.SplitHostPort(*listen)
	if err != nil || net.ParseIP(host) == nil || !net.ParseIP(host).IsLoopback() {
		log.Fatal("loopback address required")
	}
	runtime.GOMAXPROCS(2)
	debug.SetMemoryLimit(128 << 20)
	if *check {
		if err := api.CheckData(*root); err != nil {
			log.Fatal(err)
		}
		if antennaEnabled() {
			if _, err := antenna.New(filepath.Join(*root, "antenna-sightings.json"), os.Getenv("PLANES_ANTENNA_FEED_URL"), 12*time.Second); err != nil {
				log.Fatal(err)
			}
		}
		fmt.Println("existing Plane stores valid")
		return
	}
	app := &api.App{Root: *root, Revision: revision}
	app.Push.Token = os.Getenv("PUSHOVER_API_TOKEN")
	server := &http.Server{Addr: *listen, Handler: app.Handler(), ReadHeaderTimeout: 3 * time.Second, ReadTimeout: 20 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 20 * time.Second, MaxHeaderBytes: 16 << 10}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()
	listener, err := net.Listen("tcp", *listen)
	if err != nil {
		log.Fatal(err)
	}
	var receiver *antenna.Engine
	if antennaEnabled() {
		poll := 12 * time.Second
		if ms, err := strconv.Atoi(os.Getenv("PLANES_ANTENNA_POLL_MS")); err == nil {
			poll = time.Duration(max(5000, min(60000, ms))) * time.Millisecond
		}
		receiver, err = antenna.New(filepath.Join(*root, "antenna-sightings.json"), os.Getenv("PLANES_ANTENNA_FEED_URL"), poll)
		if err != nil {
			_ = listener.Close()
			log.Fatal(err)
		}
		app.Antenna = receiver
		receiver.Start(ctx)
	}
	drained := make(chan error, 1)
	go func() {
		<-ctx.Done()
		deadline, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		defer cancel()
		drained <- server.Shutdown(deadline)
	}()
	log.Printf("Go planes revision=%s listen=%s", revision, *listen)
	err = server.Serve(listener)
	stop()
	if drainErr := <-drained; drainErr != nil {
		_ = server.Close()
		log.Print(drainErr)
	}
	if receiver != nil {
		if flushErr := receiver.Wait(); flushErr != nil {
			log.Fatal("antenna shutdown persistence failed: ", flushErr)
		}
	}
	if err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
func antennaEnabled() bool {
	enabled := strings.ToLower(strings.TrimSpace(os.Getenv("PLANES_ANTENNA_ENABLED")))
	return enabled != "0" && enabled != "false" && enabled != "off"
}
