# Map Theme System

This implementation adds a flexible map theme system with automatic dark mode support based on sunset/sunrise times.

## Features

1. **Configurable Map Themes**: Easy-to-change map tile layers
2. **Automatic Dark Mode**: Switches to dark theme after sunset
3. **Manual Theme Control**: Toggle between themes manually
4. **Multiple Theme Options**: Support for various tile providers

## How to Use

### UI Controls

The map now includes two new buttons in the control panel:

1. **Theme Toggle Button** (🌙/☀️): 
   - Manually switches between light and dark themes
   - Icon changes based on current theme

2. **Auto Dark Mode Button** (🌙/☀️):
   - Enables/disables automatic theme switching at sunset
   - Green highlight when auto mode is active

### Automatic Dark Mode

When auto dark mode is enabled:
- The map automatically switches to dark theme at civil twilight (sun elevation < -6°)
- Switches back to light theme at sunrise
- Uses the existing brightness service for sun position calculations

### Changing Map Themes

To change the default themes, edit `src/app/config/map-themes.config.ts`:

```typescript
export const MAP_THEMES: MapThemeConfig = {
  default: {
    id: 'your-theme',
    name: 'Your Theme Name',
    tileUrl: 'https://your-tile-server/{z}/{x}/{y}.png',
    attribution: '© Your Attribution',
    maxZoom: 18,
    minZoom: 2
  },
  dark: {
    // Your dark theme configuration
  }
};
```

### Available Alternative Themes

The configuration includes several pre-configured alternative themes:

1. **Esri Dark Gray**: Professional dark theme with reference layer
2. **Stamen Toner**: High contrast black and white theme
3. **CartoDB Dark Matter**: Current default dark theme

To switch to an alternative theme, replace the theme object in the config.

### Implementation Details

#### Services

- `MapThemeService`: Manages theme switching and automatic dark mode
- `BrightnessService`: Provides sun position data for auto switching

#### Components

- Theme controls integrated into existing `InputOverlayComponent`
- Styling follows existing UI patterns

#### Configuration

- All themes defined in `map-themes.config.ts`
- Easy to add new tile providers
- Support for base + reference layer combinations

## Technical Notes

- Themes are applied using Leaflet tile layers
- Automatic switching uses civil twilight (-6° sun elevation) as the threshold
- The system properly cleans up layers when switching themes
- All theme state is managed reactively using RxJS observables

## Customization

To add a new theme:

1. Add theme definition to `map-themes.config.ts`
2. Optionally add to `ALTERNATIVE_DARK_THEMES` array
3. Use `MapThemeService.setTheme()` to apply programmatically

The system is designed to be easily extensible for additional themes and providers.
