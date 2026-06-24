import {
  trigger,
  transition,
  style,
  query,
  animate,
} from '@angular/animations';

export const resultsListAnimation = trigger('listAnimation', [
  transition('* <=> *', [
    query(
      ':enter',
      [
        style({ opacity: 0, transform: 'translateX(-10px)' }),
        animate(
          '200ms ease-out',
          style({ opacity: 1, transform: 'translateX(0)' })
        ),
      ],
      { optional: true }
    ),
    query(
      ':leave',
      [
        animate(
          '200ms ease-in',
          style({ opacity: 0, transform: 'translateX(10px)' })
        ),
      ],
      { optional: true }
    ),
  ]),
]);
