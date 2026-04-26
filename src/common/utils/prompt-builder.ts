interface PromptBlock {
  title: string;
  content: string;
}

export class PromptBuilder {
  private blocks: PromptBlock[] = [];

  add(title: string, content: string) {
    this.blocks.push({ title, content });

    return this;
  }

  build() {
    return this.blocks
      .map((b) => `### ${b.title}\n${b.content}`)
      .join('\n\n');
  }
}
