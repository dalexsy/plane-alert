// src/app/components/context-menu/context-menu.component.ts
import {
  Component,
  Input,
  Output,
  EventEmitter,
  HostListener,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ContextMenuItem {
  label: string;
  action: string;
  icon?: string;
  disabled?: boolean;
}

@Component({
  selector: 'app-context-menu',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './context-menu.component.html',
  styleUrls: ['./context-menu.component.scss'],
})
export class ContextMenuComponent implements OnChanges {
  @Input() items: ContextMenuItem[] = [];
  @Input() position: { x: number; y: number } = { x: 0, y: 0 };
  @Input() visible: boolean = false;

  @Output() itemSelected = new EventEmitter<string>();
  @Output() closeMenu = new EventEmitter<void>();

  ngOnChanges() {
    // Component changes handled automatically
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (this.visible) {
      this.closeMenu.emit();
    }
  }

  @HostListener('document:contextmenu', ['$event'])
  onDocumentContextMenu(event: Event): void {
    if (this.visible) {
      event.preventDefault();
      this.closeMenu.emit();
    }
  }

  onItemClick(action: string, event: Event): void {
    event.stopPropagation();
    this.itemSelected.emit(action);
    this.closeMenu.emit();
  }
}
