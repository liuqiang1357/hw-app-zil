function splitPath(path) {
  let result = [];
  let components = path.split('/');
  components.forEach(element => {
    let number = parseInt(element, 10);
    if (isNaN(number)) {
      throw Error(`Path ${path} is invalid.`);
    }
    if (element.length > 1 && element[element.length - 1] === "'") {
      number += 0x80000000;
    }
    result.push(number);
  });
  return result;
}

module.exports = {
  splitPath,
}