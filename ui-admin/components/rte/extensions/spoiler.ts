import { InputRule, Mark, mergeAttributes } from "@tiptap/core";

export const Spoiler = Mark.create({
  name: "spoiler",

  parseHTML() {
    return [{ tag: "span[data-spoiler]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        "data-spoiler": "true",
        class: "spoiler",
      }),
      0,
    ];
  },

  addInputRules() {
    return [
      new InputRule({
        find: /\|\|([^|]+)\|\|$/,
        handler: ({ state, range, match }) => {
          const content = match[1];
          if (!content) {
            return;
          }

          const { tr } = state;
          tr.replaceWith(range.from, range.to, state.schema.text(content, [this.type.create()]));
          tr.removeStoredMark(this.type);
        },
      }),
    ];
  },

  addCommands() {
    return {
      toggleSpoiler:
        () =>
        ({ commands }) =>
          commands.toggleMark(this.name),
    };
  },
});

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    spoiler: {
      toggleSpoiler: () => ReturnType;
    };
  }
}
