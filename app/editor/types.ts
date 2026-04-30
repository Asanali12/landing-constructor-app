export type NodeId = string;

export type EventBinding = {
  trigger: string;
  action: string;
  payload?: Record<string, unknown>;
};

export type ElementNode = {
  id: NodeId;
  kind: "element";
  tag: string;
  attributes: Record<string, string>;
  children: EditorNode[];
  events?: EventBinding[];
};

export type TextNode = {
  id: NodeId;
  kind: "text";
  text: string;
};

export type EditorNode = ElementNode | TextNode;

export type EditorDocument = {
  children: EditorNode[];
};

export const isElement = (n: EditorNode): n is ElementNode => n.kind === "element";
export const isText = (n: EditorNode): n is TextNode => n.kind === "text";
