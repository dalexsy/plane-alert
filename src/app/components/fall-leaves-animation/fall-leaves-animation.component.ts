import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';

interface Leaf {
  id: number;
  x: number;
  y: number;
  rotation: number;
  scale: number;
  colorClass: string;
  progress: number;
  speed: number;
  swayOffset: number;
}

@Component({
  selector: 'app-fall-leaves-animation',
  templateUrl: './fall-leaves-animation.component.html',
  styleUrls: ['./fall-leaves-animation.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class FallLeavesAnimationComponent
  implements OnInit, OnDestroy, OnChanges
{
  @Input() isAutumn: boolean = false;
  @Input() animationsEnabled: boolean = true;
  @Input() windSpeed: number = 0;

  leaves: Leaf[] = [];
  private animationFrameId: number | null = null;
  private readonly leafCount = 15;
  private readonly baseFallSpeed = 0.0003; // Base falling speed per frame (much slower)
  private readonly baseSwaySpeed = 0.001; // Much slower rotation speed

  ngOnInit(): void {
    if (this.isAutumn && this.animationsEnabled) {
      this.initializeLeaves();
      this.startAnimation();
    }
  }

  ngOnDestroy(): void {
    this.stopAnimation();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isAutumn'] || changes['animationsEnabled']) {
      if (this.isAutumn && this.animationsEnabled) {
        if (this.leaves.length === 0) {
          this.initializeLeaves();
        }
        this.startAnimation();
      } else {
        this.stopAnimation();
      }
    }
    if (changes['windSpeed']) {
      this.updateLeafSpeeds();
    }
  }

  private initializeLeaves(): void {
    this.leaves = [];
    const colorClasses = [
      'leaf-red',
      'leaf-orange',
      'leaf-yellow',
      'leaf-brown',
      'leaf-gold',
      'leaf-crimson',
      'leaf-amber',
      'leaf-maroon',
    ];

    for (let i = 0; i < this.leafCount; i++) {
      this.leaves.push({
        id: i,
        x: Math.random() * 100, // Random horizontal position
        y: Math.random() * -20, // Start above the viewport
        rotation: Math.random() * 360,
        scale: 0.3 + Math.random() * 0.4, // Scale between 0.3 and 0.7
        colorClass:
          colorClasses[Math.floor(Math.random() * colorClasses.length)],
        progress: Math.random(), // Random starting progress
        speed: this.calculateLeafSpeed(),
        swayOffset: Math.random() * Math.PI * 2, // Random sway phase
      });
    }
  }

  private calculateLeafSpeed(): number {
    // Base speed plus wind influence (wind speed in m/s, convert to animation factor)
    const windFactor = Math.max(0.5, Math.min(2.0, 1 + this.windSpeed / 10));
    return this.baseFallSpeed * windFactor * (0.3 + Math.random() * 1.4); // More speed variation (0.3x to 1.7x)
  }

  private updateLeafSpeeds(): void {
    this.leaves.forEach((leaf) => {
      leaf.speed = this.calculateLeafSpeed();
    });
  }

  private startAnimation(): void {
    if (this.animationFrameId) return;

    const animate = () => {
      this.updateLeaves();
      this.animationFrameId = requestAnimationFrame(animate);
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  private updateLeaves(): void {
    this.leaves.forEach((leaf) => {
      // Update progress based on speed
      leaf.progress += leaf.speed;

      // Reset leaf when it falls off screen
      if (leaf.progress >= 1) {
        leaf.progress = 0;
        leaf.x = Math.random() * 100;
        leaf.y = Math.random() * -20;
        leaf.rotation = Math.random() * 360;
        leaf.swayOffset = Math.random() * Math.PI * 2;
        leaf.speed = this.calculateLeafSpeed();
      }

      // Calculate current position
      leaf.y = -20 + leaf.progress * 120; // Fall from -20 to 100

      // Horizontal position stays mostly steady (very subtle drift only)
      // Removed active horizontal swaying to keep leaves more vertical

      // Wrap around horizontally
      if (leaf.x > 100) leaf.x = 0;
      if (leaf.x < 0) leaf.x = 100;

      // Add rotation
      leaf.rotation += (this.baseSwaySpeed * 180) / Math.PI;
    });
  }
}
