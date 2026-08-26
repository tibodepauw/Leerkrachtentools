function quote(content: string) {
  return content
    .trim()
    .replace(/^["“”']+|["“”']+$/g, "")
    .trim();
}

export function enforceThomasMoreDialogue(value: string) {
  return value
    .split(/\r?\n/)
    .map((rawLine) => {
      const line = rawLine.trim();
      if (!line) return "";
      const boardAction = line.match(/^\*?\[([\s\S]+)]\*?$/);
      if (boardAction) return `*[${boardAction[1]}]*`;
      const teacher = line.match(/^Lk:\s*([\s\S]+)$/i);
      if (teacher) return `Lk: “${quote(teacher[1])}”`;
      const pupils = line.match(/^Lln:\s*([\s\S]+)$/i);
      if (pupils) return `Lln: “${quote(pupils[1])}”`;
      return `Lk: “${quote(line)}”`;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
}

export function isStrictThomasMoreDialogue(value: string) {
  return value
    .split(/\r?\n/)
    .filter(Boolean)
    .every(
      (line) =>
        /^Lk: “.+”$/.test(line) ||
        /^Lln: “.+”$/.test(line) ||
        /^\*\[.+]\*$/.test(line),
    );
}
