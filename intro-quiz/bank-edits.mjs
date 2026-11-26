// 관리 페이지(aanah.fyi/admin → 문제은행)에서 고친 기본 문제은행 수정 내역.
// Claude가 D1 bank_edits의 반영 대기 수정안을 이 파일에 옮기고 배포한다.
//
// 형식: 'song-id': { 필드: { to: 새 값, from: [예전 기본값들] } }
//   to   기본 문제은행에 쓸 값. null이면 그 필드를 지운다(작품명·숏폼 시작 등 선택 항목).
//   from 이 곡의 예전 기본값들. 선생님 브라우저에 저장된 값이 이 중 하나와 같으면 선생님이
//        직접 고치지 않은 것으로 보고 새 값으로 바꾼다. 다르면 선생님이 고친 값이므로 그대로 둔다.
//        같은 필드를 다시 고칠 때는 이전 to를 from에 덧붙인다.
export const BANK_EDITS = {
  // 2026-11-26: 밈·챌린지 곡은 일반 모드에서도 챌린지 구간부터 튼다(싱크 가사 시간 기준, 마라탕후루는 제외).
  "song-215": {
    "introStart": {
      "to": 1,
      "from": [
        0
      ]
    }
  },
  "song-220": {
    "introStart": {
      "to": 81.6,
      "from": [
        0
      ]
    }
  },
  "song-161": {
    "introVideo": {
      "to": "pShwcQAk7Js",
      "from": [
        "Gih5JOFQ1YQ"
      ]
    }
  },
  "song-153": {
    "introVideo": {
      "to": "EkoS0426BeQ",
      "from": [
        "kyYyXncI3jw"
      ]
    }
  },
  "song-152": {
    "introVideo": {
      "to": "cmvO6x72d2k",
      "from": [
        "zz723Sc3vak"
      ]
    }
  },
  "song-59": {
    "introVideo": {
      "to": "NPuSOY0afXQ",
      "from": [
        "yLIXg3gIj-8"
      ]
    }
  },
  "song-47": {
    "introVideo": {
      "to": "sdv_NeL6Ds8",
      "from": [
        "EvLfnrHaDm0"
      ]
    }
  },
  "song-210": {
    "introVideo": {
      "to": "oF4X5OkAiq8",
      "from": [
        "D92O5JT3E8A"
      ]
    },
    "introStart": {
      "to": 0.86,
      "from": [
        0
      ]
    }
  },
  "song-208": {
    "introStart": {
      "to": 0.82,
      "from": [
        0
      ]
    }
  },
  "song-205": {
    "introVideo": {
      "to": "MjXeOAouF3w",
      "from": [
        "PVIf531Dt8E"
      ]
    },
    "introStart": {
      "to": 4.44,
      "from": [
        0
      ]
    }
  },
  "song-201": {
    "introStart": {
      "to": 1.56,
      "from": [
        0
      ]
    }
  },
  "song-200": {
    "introStart": {
      "to": 0.5,
      "from": [
        0
      ]
    }
  },
  "song-199": {
    "introStart": {
      "to": 0.68,
      "from": [
        0
      ]
    }
  },
  "song-196": {
    "introStart": {
      "to": 1.02,
      "from": [
        0
      ]
    }
  },
  "song-193": {
    "introStart": {
      "to": 0.66,
      "from": [
        0
      ]
    }
  },
  "song-192": {
    "introStart": {
      "to": 0.42,
      "from": [
        0
      ]
    }
  },
  "song-173": {
    "introStart": {
      "to": 1.12,
      "from": [
        0
      ]
    }
  },
  "song-166": {
    "introStart": {
      "to": 1.38,
      "from": [
        0
      ]
    }
  },
  "song-165": {
    "introStart": {
      "to": 0.52,
      "from": [
        0
      ]
    }
  },
  "song-155": {
    "introStart": {
      "to": 0.42,
      "from": [
        0
      ]
    }
  },
  "song-145": {
    "introStart": {
      "to": 0.48,
      "from": [
        0
      ]
    }
  },
  "song-127": {
    "introStart": {
      "to": 0.42,
      "from": [
        0
      ]
    }
  },
  "song-117": {
    "introStart": {
      "to": 0.5,
      "from": [
        0
      ]
    }
  },
  "song-116": {
    "introStart": {
      "to": 0.42,
      "from": [
        0
      ]
    }
  },
  "song-110": {
    "introStart": {
      "to": 0.46,
      "from": [
        0
      ]
    }
  },
  "song-211": {
    "introVideo": {
      "to": "MQMzMgqcuKk",
      "from": [
        "fBB4MaBybyg"
      ]
    },
    "introStart": {
      "to": 0.44,
      "from": [
        0
      ]
    }
  },
  "song-219": {
    "introStart": {
      "to": 0.48,
      "from": [
        0
      ]
    }
  },
  "song-218": {
    "introStart": {
      "to": 0.48,
      "from": [
        0
      ]
    }
  },
  "song-221": {
    "introStart": {
      "to": 0.44,
      "from": [
        0
      ]
    }
  },
  "song-236": {
    "introStart": {
      "to": 0.64,
      "from": [
        0
      ]
    }
  },
  "song-108": {
    "introStart": {
      "to": 0.42,
      "from": [
        0
      ]
    }
  },
  "song-70": {
    "introStart": {
      "to": 0.56,
      "from": [
        0
      ]
    }
  },
  "song-69": {
    "introStart": {
      "to": 0.42,
      "from": [
        0
      ]
    }
  },
  "song-64": {
    "introStart": {
      "to": 0.46,
      "from": [
        0
      ]
    }
  },
  "song-61": {
    "introStart": {
      "to": 0.74,
      "from": [
        0
      ]
    }
  },
  "song-60": {
    "introStart": {
      "to": 0.52,
      "from": [
        0
      ]
    }
  },
  "song-50": {
    "introStart": {
      "to": 0.78,
      "from": [
        0
      ]
    }
  },
  "song-49": {
    "introStart": {
      "to": 0.44,
      "from": [
        0
      ]
    }
  },
  "song-45": {
    "introStart": {
      "to": 0.56,
      "from": [
        0
      ]
    }
  },
  "song-44": {
    "introStart": {
      "to": 0.46,
      "from": [
        0
      ]
    }
  },
  "song-43": {
    "introStart": {
      "to": 0.58,
      "from": [
        0
      ]
    }
  },
  "song-40": {
    "introStart": {
      "to": 0.44,
      "from": [
        0
      ]
    }
  },
  "song-235": {
    "introStart": {
      "to": 0.96,
      "from": [
        0
      ]
    }
  },
  "song-232": {
    "introStart": {
      "to": 1.98,
      "from": [
        0
      ]
    }
  },
  "song-231": {
    "introStart": {
      "to": 2.68,
      "from": [
        0
      ]
    }
  },
  "song-230": {
    "introStart": {
      "to": 1.74,
      "from": [
        0
      ]
    }
  },
  "song-228": {
    "introStart": {
      "to": 9.6,
      "from": [
        0
      ]
    }
  },
  "song-227": {
    "introStart": {
      "to": 0.76,
      "from": [
        0
      ]
    }
  },
  "song-226": {
    "introStart": {
      "to": 0.56,
      "from": [
        0
      ]
    }
  },
  "song-225": {
    "introStart": {
      "to": 52.3,
      "from": [
        0
      ]
    }
  },
  "song-209": {
    "introStart": {
      "to": 1.08,
      "from": [
        0
      ]
    }
  },
  "song-206": {
    "introStart": {
      "to": 1.38,
      "from": [
        0
      ]
    }
  },
  "song-204": {
    "introStart": {
      "to": 1.64,
      "from": [
        0
      ]
    }
  },
  "song-195": {
    "introStart": {
      "to": 0.74,
      "from": [
        0
      ]
    }
  },
  "song-190": {
    "introStart": {
      "to": 0.88,
      "from": [
        0
      ]
    }
  },
  "song-186": {
    "introStart": {
      "to": 0.64,
      "from": [
        0
      ]
    }
  },
  "song-185": {
    "introStart": {
      "to": 1.1,
      "from": [
        0
      ]
    }
  },
  "song-181": {
    "introStart": {
      "to": 5.02,
      "from": [
        0
      ]
    }
  },
  "song-179": {
    "introStart": {
      "to": 2.14,
      "from": [
        0
      ]
    }
  },
  "song-151": {
    "introStart": {
      "to": 0.7,
      "from": [
        0
      ]
    }
  },
  "song-150": {
    "introStart": {
      "to": 0.86,
      "from": [
        0
      ]
    }
  },
  "song-139": {
    "introStart": {
      "to": 0.62,
      "from": [
        0
      ]
    }
  },
  "song-137": {
    "introStart": {
      "to": 0.52,
      "from": [
        0
      ]
    }
  },
  "song-135": {
    "introStart": {
      "to": 1.3,
      "from": [
        0
      ]
    }
  },
  "song-131": {
    "introStart": {
      "to": 0.92,
      "from": [
        0
      ]
    }
  },
  "song-122": {
    "introStart": {
      "to": 0.76,
      "from": [
        0
      ]
    }
  },
  "song-119": {
    "introStart": {
      "to": 0.64,
      "from": [
        0
      ]
    }
  },
  "song-115": {
    "introStart": {
      "to": 1.32,
      "from": [
        0
      ]
    }
  },
  "song-113": {
    "introStart": {
      "to": 1.1,
      "from": [
        0
      ]
    }
  },
  "song-106": {
    "introStart": {
      "to": 0.9,
      "from": [
        0
      ]
    }
  },
  "song-100": {
    "introStart": {
      "to": 0.96,
      "from": [
        0
      ]
    }
  },
  "song-63": {
    "introStart": {
      "to": 0.76,
      "from": [
        0
      ]
    }
  },
  "song-46": {
    "introStart": {
      "to": 0.84,
      "from": [
        0
      ]
    }
  },
  "song-42": {
    "introStart": {
      "to": 0.6,
      "from": [
        0
      ]
    }
  },
  "song-36": {
    "introStart": {
      "to": 0.52,
      "from": [
        0
      ]
    }
  },
  "song-35": {
    "introStart": {
      "to": 0.6,
      "from": [
        0
      ]
    }
  },
  "song-8": {
    "introStart": {
      "to": 0.6,
      "from": [
        0
      ]
    }
  },
  "song-6": {
    "introStart": {
      "to": 0.56,
      "from": [
        0
      ]
    }
  },
  "song-1": {
    "introStart": {
      "to": 0.52,
      "from": [
        0
      ]
    }
  },
  "song-34": {
    "introStart": {
      "to": 1.1,
      "from": [
        0
      ]
    }
  },
  "song-32": {
    "introStart": {
      "to": 1.6,
      "from": [
        0
      ]
    }
  },
  "song-25": {
    "introStart": {
      "to": 1.3,
      "from": [
        0
      ]
    }
  },
  "song-22": {
    "introStart": {
      "to": 2,
      "from": [
        0
      ]
    }
  },
  "song-16": {
    "introVideo": {
      "to": "7bfRf7N0hXg",
      "from": [
        "JaMblWT0SXY"
      ]
    }
  },
  "song-14": {
    "introVideo": {
      "to": "aS7al94FVbk",
      "from": [
        "HMQlkbXjSTM"
      ]
    },
    "introStart": {
      "to": 1,
      "from": [
        0
      ]
    }
  },
  "song-11": {
    "introVideo": {
      "to": "sJWzsH9Y4KY",
      "from": [
        "qIr5sM5TKp4"
      ]
    }
  },
  "song-7": {
    "introStart": {
      "to": 1,
      "from": [
        0
      ]
    }
  },
  "song-5": {
    "introStart": {
      "to": 1,
      "from": [
        0
      ]
    }
  },
  "song-4": {
    "introStart": {
      "to": 3,
      "from": [
        0
      ]
    }
  },
  "song-3": {
    "introStart": {
      "to": 1,
      "from": [
        0
      ]
    }
  }
};
