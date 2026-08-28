// Rendering-only topology: never changes collisions, locking or line clearing.
export function pieceCells(piece) {
  if (!piece) return [];
  const cells = [];
  piece.matrix.forEach((row, y) => row.forEach((value, x) => {
    if (value) cells.push({x: piece.x + x, y: piece.y + y});
  }));
  return cells;
}
export function boardCells(board) {
  const cells = [];
  board.forEach((row, y) => row.forEach((value, x) => {
    if (value) cells.push({x,y});
  }));
  return cells;
}
export function connections(cells) {
  const unique = new Map(cells.filter(c => c.y >= 0).map(c => [`${c.x},${c.y}`, c]));
  const links = [];
  for (const {x,y} of unique.values()) {
    if (unique.has(`${x+1},${y}`)) links.push({x,y,direction:'right'});
    if (unique.has(`${x},${y+1}`)) links.push({x,y,direction:'down'});
  }
  return links;
}
export function drawSquirrels(context, cells, size, sprites) {
  if (!sprites) return;
  const visible = cells.filter(c => c.y >= 0);
  // Faces always remain upright, including when the falling shape rotates.
  for (const {x,y} of visible) {
    context.drawImage(sprites.face, (x+.03)*size, (y+.03)*size, size*.94, size*.94);
  }
  // Draw each shared edge once, after all faces, to make clasped paws legible.
  for (const {x,y,direction} of connections(visible)) {
    context.save();
    if (direction === 'right') context.translate((x+1)*size, (y+.82)*size);
    else {context.translate((x+.5)*size, (y+1)*size);context.rotate(Math.PI/2);}
    context.drawImage(sprites.hands, -size*.32, -size*.32, size*.64, size*.64);
    context.restore();
  }
}
