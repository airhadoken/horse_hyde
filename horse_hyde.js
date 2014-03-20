var startwords;
var wordstats = {};
var words, lastword; // these are used in the for loop below
var LINEBREAK = "/\n";
var NOTERMREGEX = /\b(an?|the|i)$/;

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
  process.exit(-1);
}
});
var titles = lines;


for (var i = 0; i < titles.length; i++) {
    var words = titles[i];
    if(!words)
      continue;
    // strip all punctuation from words except for apostrophes
    words = words.split(' ')
            .map(function(word) { return word.replace(/[^a-zA-Z']/g, "").toLowerCase().trim(); })
            .filter(function(word) { return word.trim().length; });
    if(words.length < 1)
      continue;
    for (var j = 0; j < words.length - 1; j++) {
      // This isn't perfect, since we stop at line breaks
      function pushnew(key, next) {
        if (wordstats.hasOwnProperty(key)) {
            wordstats[key].push(next);
        } else {
            wordstats[key] = [next];
        }
      }
      pushnew(words[j], words[j+1]);
      if(words[j+2]) {
        pushnew(words[j], words[j+1] + " " + words[j+2]);
      }

      if(lastword) {
        pushnew(lastword + " " + words[j], words[j+1]);
        if(words[j+2]) {
          pushnew(lastword + " " + words[j], words[j+1] + " " + words[j+2]);
        }
      }
      lastword = words[j];
    }
}
startwords = Object.keys(wordstats);

var choice = function (a) {
    var i = Math.floor(a.length * Math.random());
    return a[i];
};

var make_title = function (min_length) {
    // Underwold thing: put a repeating word at the end of every phrase
    // i.e. "hands girls boy / and steel boy / you had chemicals boy / I've grown so close to you boy"
    // Chance 25%.
    //  If two word phrase chosen from corpus, 50% chance of using just the second word 
    var stopword = Math.random() < 0.25 ? choice(startwords) : null;
    if(stopword && ~stopword.indexOf(" ") && Math.random() < 0.5) {
      stopword = stopword.substr(stopword.indexOf(" ") + 1);
    }
    var word = [choice(startwords)];
    var title = word.slice(0);
    var next_words;
    while (title.join(' ').length < min_length || NOTERMREGEX.test(word.join(" "))) {
        next_words = null;
        // 30% chance of trying to find a key in the corpus from the last two words
        //  combined. (frequency weighted)
        // Avoid combining with a previous newline. Pick the word before the newline
        //  if you encounter it.
        if(title.length > 1 && Math.random() < 0.3) {
          next_words = wordstats[word.length > 1 
                                 ? word.join(" ") 
                                 : (title[title.length - 2]===LINEBREAK 
                                    ? title[title.length-3] 
                                    : title[title.length-2])
                                   + " " + word[0]
                                 ];
        }
        // 56-80% chance (depends on whether key is found above) of finding next
        // Markov step based on the last word alone. (frequency weighted)
        if(Math.random() < 0.8) {
          next_words = next_words || wordstats[word[1] || word[0]];        
        }
        // 14-20% chance of random word from corpus (evenly weighted)
        next_words = next_words || startwords;
        word = choice(next_words);
        word = word.split(" ");
        title = title.concat(word);
        // After 1-2 words have been added, 30% chance of splitting
        //  to new line.  Use stopword if it has been selected.
        if(!NOTERMREGEX.test(word.join(" ")) && Math.random() < 0.3) {
          stopword && title.push(stopword);
          title.push(LINEBREAK);
        }
    }
    // Don't end with a linebreak (slash-then-newline).
    if(title[title.length - 1] === LINEBREAK) {
      title.pop();
    }
    return title.join(' ');
};

var m = make_title(100);
console.log(m);
setTimeout(function() {
  process.exit(0);
}, 100);