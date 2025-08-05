var cp = require('child_process');
var sq = require('shell-quote');

var MECAB_LIB_PATH =
    process.env.MECAB_LIB_PATH ?
    process.env.MECAB_LIB_PATH :
    __dirname + '/mecab';

var buildCommand = function (text) {
    return 'LD_LIBRARY_PATH=' + MECAB_LIB_PATH + ' ' +
        sq.quote(['echo', text]) + ' | ' + MECAB_LIB_PATH + '/bin/mecab -b 65536';
};

var execMecab = function (text, callback) {
    cp.exec(buildCommand(text), function(err, result) {
        if (err) { return callback(err); }
        callback(err, result);
    });
};

var execMecabSync = function (text) {
    return String(cp.execSync(buildCommand(text)));
};

var parseFunctions = {
    'pos': function (result, elems) {
        result.push([elems[0]].concat(elems[1].split(',')[0]));
        return result;
    },

    'morphs': function (result, elems) {
        result.push(elems[0]);
        return result;
    },

    'nouns': function (result, elems) {
        var tag = elems[1].split(',')[0];
        
        if (tag === 'NNG' || tag === 'NNP') {
            result.push(elems[0]);
        }

        return result;
    },

    'all': function (result, elems) {
        result.push([elems[0]].concat(elems[1].split(',')));
        return result;
    },
};

var parse = function (text, method, callback) {
    execMecab(text, function (err, result) {
        if (err) { return callback(err); }

        result = result.split('\n').reduce(function(parsed, line) {
            var elems = line.split('\t');

            if (elems.length > 1) {
                return parseFunctions[method](parsed, elems);
            } else {
                return parsed;
            }
        }, []);

        callback(err, result);
    });
};

var parseSync = function (text, method) {
    ret = [];
    result = execMecabSync(text).split('\n')
    for (var i=0; i<result.length; i++) {
        tmp = result[i].split('\t')
        if (tmp.length>1)
            parseFunctions[method](ret, tmp)
    }
    return ret;
};

var pos = function (text, callback) {
    parse(text, 'pos', callback);
};

var morphs = function (text, callback) {
    parse(text, 'morphs', callback);
};

var nouns = function (text, callback) {
    parse(text, 'nouns', callback);
};

var all = function (text, callback) {
    parse(text, 'all', callback);
};

var posSync = function (text) {
    return parseSync(text, 'pos');
}

var morphsSync = function (text) {
    return parseSync(text, 'morphs');
}

var nounsSync = function (text) {
    return parseSync(text, 'nouns');
}

var allSync = function (text) {
    return parseSync(text, 'all');
}

const { spawn } = require('child_process');

const MECAB_PATH = __dirname + '/mecab';
const MECAB_BIN = `${MECAB_PATH}/bin/mecab`;
const ENV    = { ...process.env, LD_LIBRARY_PATH: MECAB_PATH };
const proc  = spawn(MECAB_BIN, ['-b', '65536'], { env: ENV });
let  buf  = '';
const queue = [];

proc.stdout.on('data', chunk => {
 buf += chunk.toString();
 if (buf.endsWith('EOS\n')) {
  const raw = buf.slice(0, -4); // 'EOS\n' 제거
  buf = '';
  const result = raw
   .split('\n')
   .reduce((arr, line) => {
    const [surface, feat] = line.split('\t');
    if (feat) {
     arr.push([ surface, feat.split(',')[0] ]);
    }
    return arr;
   }, []);

  // 큐에서 대기 중인 resolve 호출
  const cb = queue.shift();
  if (cb) cb(result);
 }
});

function cmd(text) {
 return new Promise(resolve => {
  queue.push(resolve);
  proc.stdin.write(text.replace(/\n/g, ' ') + '\n');
 });
}

module.exports = {
  pos: pos,
  morphs: morphs,
  nouns: nouns,
  all: all,
  posSync: posSync,
  morphsSync: morphsSync,
  nounsSync: nounsSync,
  allSync: allSync,
  cmd
};
