package ufw

import "testing"

func TestPlanLocked(t *testing.T) {
	live := "[21] 8796/tcp ALLOW IN 192.168.178.79 # planes-kiosk-alert from dryl-prod"
	del, add := Plan(live, KnownProdIP, AlertPort)
	if len(del) != 0 || add {
		t.Fatalf("del=%v add=%v", del, add)
	}
}

func TestPlanWide(t *testing.T) {
	wide := "[ 8] 8796/tcp ALLOW IN Anywhere\n[ 9] 8796/tcp ALLOW IN Anywhere (v6)\n"
	del, add := Plan(wide, KnownProdIP, AlertPort)
	if len(del) != 2 || del[0] != 9 || del[1] != 8 || !add {
		t.Fatalf("del=%v add=%v", del, add)
	}
}

func TestAllowCmd(t *testing.T) {
	cmd, err := AllowCmd(KnownProdIP, AlertPort)
	if err != nil {
		t.Fatal(err)
	}
	if cmd != "ufw allow from 192.168.178.79 to any port 8796 proto tcp comment 'planes-kiosk-alert from dryl-prod'" {
		t.Fatal(cmd)
	}
	if _, err := AllowCmd("0.0.0.0", AlertPort); err == nil {
		t.Fatal("expected refuse")
	}
	if _, err := AllowCmd("192.168.178.74", AlertPort); err == nil {
		t.Fatal("expected refuse kiosk")
	}
}
