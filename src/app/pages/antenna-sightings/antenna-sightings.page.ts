import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ButtonComponent } from '../../components/ui/button/button.component';
import { InputComponent } from '../../components/ui/input/input.component';
import {
  AntennaSightingsService,
  type AntennaSightingsResponse,
} from '../../services/antenna-sightings/antenna-sightings.service';
import {
  formatBerlinTime,
  toTableRows,
  type AntennaTableRow,
} from '../../services/antenna-sightings/antenna-sightings-display.util';

@Component({
  selector: 'app-antenna-sightings-page',
  standalone: true,
  imports: [CommonModule, ButtonComponent, InputComponent],
  templateUrl: './antenna-sightings.page.html',
  styleUrl: './antenna-sightings.page.scss',
})
export class AntennaSightingsPage implements OnInit, OnDestroy {
  search = '';
  todayOnly = true;
  sort: 'lastSeen' | 'closest' = 'lastSeen';
  loading = true;
  error: string | null = null;
  statusLine = '';
  emptyLabel = 'No aircraft logged yet.';
  rows: AntennaTableRow[] = [];

  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly api: AntennaSightingsService,
    private readonly title: Title,
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Antenna sightings | Planes | dryl.io');
    void this.reload();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
  }

  goMap(): void {
    location.assign('/');
  }

  onSearchChange(value: string): void {
    this.search = value;
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => void this.reload(), 250);
  }

  setToday(today: boolean): void {
    this.todayOnly = today;
    void this.reload();
  }

  setSort(sort: 'lastSeen' | 'closest'): void {
    this.sort = sort;
    void this.reload();
  }

  private async reload(): Promise<void> {
    this.loading = true;
    this.error = null;
    try {
      const data = await this.api.list({
        q: this.search,
        sort: this.sort,
        today: this.todayOnly,
      });
      this.applyResponse(data);
    } catch {
      this.error = 'Could not load antenna sightings.';
      this.rows = [];
    } finally {
      this.loading = false;
    }
  }

  private applyResponse(data: AntennaSightingsResponse): void {
    if (data.ok === false) {
      this.error = data.error || 'Could not load antenna sightings.';
      this.rows = [];
      return;
    }
    const sightings = data.sightings ?? [];
    this.rows = toTableRows(sightings);
    const unique = data.uniqueHexes ?? sightings.length;
    const matched = data.matched ?? sightings.length;
    const poll = formatBerlinTime(data.lastPollAt ?? null);
    const feed = data.feedUrl || 'feed unset';
    const pollState =
      data.lastPollOk === false ? 'last poll failed' : `polled ${poll}`;
    this.statusLine = `${matched} shown · ${unique} unique · ${pollState} · ${feed}`;
    this.emptyLabel = this.search
      ? `No matches for “${this.search}”.`
      : this.todayOnly
        ? 'Nothing seen today yet.'
        : 'No aircraft logged yet.';
  }
}
