// Every piece of in-world writing. PRESENT and ECHO versions differ: the ruin hides what the past shows.

import type { Keepsake, Timeline } from './types';

export const DOOR_MESSAGE = ['YOU HAVE BEEN HERE BEFORE', 'ONLY THE PRESENT MAY LEAVE'];

export interface Writing { title: string; present: string; echo: string }

export const WRITINGS: Record<string, Writing> = {
  pedestal: {
    title: 'Pedestal',
    present: 'Two objects on velvet gone grey with dust. Engraved on the rim: TAKE ONE. THE ROOM WILL KEEP THE OTHER.',
    echo: 'The velvet is red again. The rim reads: TAKE ONE. THE ROOM WILL KEEP THE OTHER.',
  },
  arrival: {
    title: 'Visitor lectern',
    present: 'A visitor badge, blank. The lanyard has rotted through. Someone scratched a line into the wood: "press the hour back — Q".',
    echo: 'PARALLAX INSTITUTE — MEMORY ENGINE, HALL ONE. 14 March 1956. Operator on duty: R. Calder. Visitors are reminded that the hall exists twice.',
  },
  archive: {
    title: 'Archivist\'s desk',
    present: 'Water has turned the logbook to pulp. One phrase survives: "…the other half is light."',
    echo: 'CALDER, LOG 3 — The archive lamp throws the plates\' shadows onto the engravings. The engraver only ever cut half of each figure. The other half is light. Turn each plate until its shadow closes the figure, then the wall gives up what it holds.',
  },
  calder: {
    title: 'Operator\'s coat stand',
    present: 'A coat hangs here, grey with dust. The pockets are empty except for a ticket stub dated 1956.',
    echo: 'CALDER, LOG 7 — If they ever seal the hall, the engine will keep running on what it remembers. It remembers me best. I took one keepsake that night and left the other on the pedestal. I can never recall which. The room can.',
  },
  enginePlaque: {
    title: 'Calibration plate',
    present: 'Corroded brass. Only one word survives: CALIBRATION.',
    echo: 'CALIBRATION LAW — Each ring rests two stations clockwise of the ring that holds it. Stations are read clockwise from the top: I to VIII.',
  },
  finalPlaque: {
    title: 'Steering plate',
    present: 'Scratched into the metal, in a hand that looks uncomfortably like yours: "Turn it toward what the room kept. Wake it here, not there."',
    echo: 'PARALLAX STEERING — Enter the symbols as the past holds them. WHAT THE PRESENT LEARNS LAST, THE PAST KNEW FIRST.',
  },
  gate: {
    title: 'Bridge gate',
    present: 'Six steel bolts hold the gate. Their cables climb into the engine overhead. Nothing moves until it does.',
    echo: 'Six steel bolts hold the gate. A placard: "Gate releases on engine calibration."',
  },
  barrier: {
    title: 'Quarantine field',
    present: 'The field emitters at the far end of the bridge are cracked and cold.',
    echo: 'A wall of cold light across the far end of the bridge. A placard: "Quarantine field. Not to be switched off while the engine runs."',
  },
  anchor: {
    title: 'Phase anchor',
    present: 'PHASE ANCHOR — Locks the bridge to the moment of engagement. A sticker below: "It holds whatever is there. Make sure something is."',
    echo: 'PHASE ANCHOR — Locks the bridge to the moment of engagement. The span hums beside it.',
  },
  door: {
    title: 'Exit door',
    present: 'YOU HAVE BEEN HERE BEFORE. ONLY THE PRESENT MAY LEAVE.',
    echo: 'In the echo the letters are not yet cut. The door is new, and closed.',
  },
  honourBoard: {
    title: 'Operators\' board',
    present: 'A lacquered board, peeling. Six names and years, 1951 to 1956. The last line reads 1957 and a dash. The name for 1956 has been scratched out and rewritten by hand: R. CALDER.',
    echo: 'OPERATORS OF THE MEMORY ENGINE. 1951 H. Abernethy, 1952 M. Oyelaran, 1953 S. Vanterpool, 1954 L. Kristiansen, 1955 T. Ibarra, 1956 R. Calder. The line for 1957 waits, blank.',
  },
  wallClock: {
    title: 'Hall clock',
    present: 'The clock above the entrance stopped at two minutes to twelve. Nobody wound it again.',
    echo: 'The hall clock runs, ticking loudly enough to hear across the floor.',
  },
  lamp: {
    title: 'Archive lamp',
    present: 'The archive lamp lies on the floor, its lens smashed. In the present it lights nothing.',
    echo: 'The archive lamp stands on its mast, burning amber, aimed at the west wall.',
  },
  shadowWall: {
    title: 'Engraved wall',
    present: 'Three figures, each cut only halfway: the bottom of a left-pointing wedge, the right half of a disc, the bottom of a right-pointing wedge.',
    echo: 'In the echo the stone is smooth. Only the shadows of the plates fall on it.',
  },
  engine: {
    title: 'The Memory Engine',
    present: 'Three rusted rings hang in the dark. The outer one is missing a segment.',
    echo: 'The engine turns in amber light. The outer ring\'s mark sits at V, the middle at VII. The inner ring is hidden behind its spinning governor shield.',
  },
};

export function writing(id: string, t: Timeline): string {
  const w = WRITINGS[id];
  return w ? w[t] : '';
}

export function nicheText(side: 'west' | 'east', t: Timeline, kept: Keepsake | null): { title: string; body: string } {
  const maker = side === 'west' ? 'THE CARTOGRAPHER' : 'THE CLOCKMAKER';
  const resident: Keepsake = side === 'west' ? 'compass' : 'hourglass';
  const leftBehind = kept && kept !== resident;
  const title = side === 'west' ? "Cartographer's niche" : "Clockmaker's niche";
  if (t === 'present') return { title, body: `An empty niche. A brass plate reads ${maker}.` };
  if (leftBehind) {
    const what = resident === 'compass' ? 'The compass you left on the pedestal rests here, its needle trembling.' : 'The hourglass you left on the pedestal rests here. The sand is falling upwards.';
    return { title, body: `${what} A brass plate reads ${maker}. The room kept it.` };
  }
  return { title, body: `Empty, but polished. A brass plate reads ${maker}.` };
}

export const KEEPSAKE_INFO: Record<Keepsake, { name: string; desc: string }> = {
  compass: { name: 'Brass compass', desc: 'Heavy, warm, engraved "R.C.". It ticks twice when you turn it.' },
  hourglass: { name: 'Glass hourglass', desc: 'The sand hisses as it falls. The frame is engraved "R.C.".' },
};

export const ENDING: Record<Keepsake, string[]> = {
  compass: [
    'The rings open like an eye.',
    'Inside the engine there is no machine. There is a chair, a coat, and a compass worn smooth by a thumb that was yours.',
    'Seventy years ago R. Calder sealed this hall and let the engine keep the one thing it remembered best: the operator.',
    'The echo was never the past. It was you, remembered. Every note in Calder\'s hand predicted you because Calder was the one doing the predicting.',
    'You took the compass. So did Calder. The room only had to wait for you to choose the same way again.',
    'The present opens. You step into it carrying a direction, which is more than Calder ever had.',
  ],
  hourglass: [
    'The rings open like an eye.',
    'Inside the engine there is no machine. There is a chair, a coat, and an hourglass whose sand has fallen for seventy years.',
    'Seventy years ago R. Calder sealed this hall and let the engine keep the one thing it remembered best: the operator.',
    'The echo was never the past. It was you, remembered. Every note in Calder\'s hand predicted you because Calder was the one doing the predicting.',
    'You took the hourglass. So did Calder. The room only had to wait for you to choose the same way again.',
    'The present opens. You step into it carrying time, which is more than Calder ever had.',
  ],
};
