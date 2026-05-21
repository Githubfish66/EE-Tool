declare namespace JSX {
  interface IntrinsicElements {
    math: any;
    mrow: any;
    mfrac: any;
    mi: any;
    mo: any;
    mn: any;
    msub: any;
    msubsup: any;
    mtext: any;
  }
}

declare module "*?raw" {
  const content: string;
  export default content;
}

declare module "*.jpg" {
  const src: string;
  export default src;
}

declare module "plotly.js-basic-dist-min" {
  import type * as Plotly from "plotly.js";
  const PlotlyBasic: typeof Plotly;
  export default PlotlyBasic;
}
