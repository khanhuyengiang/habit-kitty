// The background music is Habit Kitty's: it plays whichever app is showing, and its volume is kept in Habit Kitty's save.
// Habit Kitty hands over its controls here when it starts, so Achievement Kitty can show and change the same volume.
export interface MusicControl {
  volume(): number;                            // 0..100
  setVolume(v: number, keep: boolean): void;   // keep: also save it (when a slider is let go)
  playing(): string;                           // the song's name
}

let control: MusicControl | null = null;
export const provideMusic = (c: MusicControl) => { control = c; };
export const music = (): MusicControl | null => control;
