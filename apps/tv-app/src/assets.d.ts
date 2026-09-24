/** Metro turns image imports into asset ids for `<Image source>`. */
declare module '*.png' {
  const asset: number;
  export default asset;
}
