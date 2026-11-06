package aircraft

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"
)

func TestCacheHasTotalMemoryAndAreaBudget(t *testing.T) {
	var f Fetcher
	for i := 0; i < 50; i++ {
		f.remember(fmt.Sprint(i), []Row{{"large": json.RawMessage(`"` + strings.Repeat("x", 1<<20) + `"`)}})
	}
	total := 0
	for _, v := range f.cache {
		total += v.Bytes
	}
	if total > 8<<20 || len(f.cache) > 4 {
		t.Fatal("cache unbounded", total, len(f.cache))
	}
	f.remember("oversized", []Row{{"large": json.RawMessage(`"` + strings.Repeat("x", 3<<20) + `"`)}})
	if _, ok := f.cache["oversized"]; ok {
		t.Fatal("oversized area cached")
	}
}
