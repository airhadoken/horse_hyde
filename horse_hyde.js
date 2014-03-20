var terminals = {};
var startwords = [];
var wordstats = {};
var wordstats22 = {};

var fs = require('fs');

var lines = [], files;
try {
  files = fs.readdirSync('data');
}
catch (err) {
  console.error("There was an error opening the data dir:");
  console.log(err);
}

files.forEach(function(file) {
    var newlines;
try {
  newlines = fs.readFileSync('data/' + file, 'utf-8');
  lines = lines.concat (newlines.split('\n').filter(function (line) {
    return line.length;
  }));
}
catch (err) {
  console.error("There was an error opening the file " + file + ":");
  console.log(err);
}
});
var titles = lines;


for (var i = 0; i < titles.length; i++) {
    var words = titles[i];
    if(!words)
      continue;
    words = words.split(' ')
            .map(function(word) { return word.replace(/[^a-zA-Z']/g, "").toLowerCase().trim(); })
            .filter(function(word) { return word.trim().length; });
    if(words.length < 1)
      continue;
    terminals[words[words.length-1]] = true;
    ~startwords.indexOf(words[0]) || startwords.push(words[0]);
    for (var j = 0; j < words.length - 1; j++) {
        if (wordstats.hasOwnProperty(words[j])) {
            wordstats[words[j]].push(words[j+1]);
        } else {
            wordstats[words[j]] = [words[j+1]];
        }

        if(j < words.length - 3) {
          var _22word = words[j] + ' ' + words[j + 1];
          if (wordstats22.hasOwnProperty(_22word)) {
              wordstats22[_22word].push(words[j+2] + ' ' + words[j+3]);
          } else {
              wordstats22[_22word] = [words[j+2] + ' ' + words[j+3]];
          }
        }
    }
}

var choice = function (a) {
    var i = Math.floor(a.length * Math.random());
    return a[i];
};

var make_title = function (min_length) {
    var word = choice(startwords);
    var title = [word];
    while (title.join(' ').length < min_length) {
        var next_words;
        if(title.length > 1 && Math.random() > 0.3) {
          next_words = wordstats22[title[title.length - 2] + ' ' + word] || wordstats[word] || startwords;
        } else {
          next_words = wordstats[word] || startwords;
        }
        word = choice(next_words);
        title.push(word);
        //if (title.length > min_length && terminals.hasOwnProperty(word)) break;
    }
    if (title.join(' ').length < min_length) return make_title(min_length);
    return title.join(' ');
};

console.log(make_title(100));
process.exit();