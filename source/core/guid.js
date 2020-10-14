/**
 * 生成符合RFC4122 v4的guid
 * @exports guid
 * @return {String} guid
 */
function guid() {
  // http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor((Math.random() * 16));
    // y值限定在[8,B]
    /* eslint-disable */
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
export default guid;
