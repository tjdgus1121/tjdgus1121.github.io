(function(r,d){if(typeof module==='object'&&module.exports)module.exports=d;else r.YoloSceneData=d;})(typeof globalThis!=='undefined'?globalThis:this,{
  "ASSET": {
    "src": "assets/street-detection-v3.png",
    "width": 1672,
    "height": 941,
    "sha256": "345ea4797d425ae055ba44fa3bc1a44732496c58696cc70e991f832e76af2cdb",
    "display": "assets/street-detection-v3.jpg",
    "channels": [
      "assets/channel-r.jpg",
      "assets/channel-g.jpg",
      "assets/channel-b.jpg"
    ]
  },
  "CLASSES": [
    "자동차",
    "사람",
    "버스",
    "자전거",
    "신호등",
    "강아지",
    "고양이"
  ],
  "OBJECTS": [
    {
      "id": "car",
      "label": "자동차",
      "cls": 0,
      "box": {
        "x": 0.23,
        "y": 0.49,
        "w": 0.3,
        "h": 0.3
      },
      "center": [
        0.38,
        0.64
      ],
      "pixel": [
        628,
        619
      ],
      "rgb": [
        218,
        169,
        51
      ],
      "prob": [
        0.8,
        0.1,
        0.02,
        0.02,
        0.02,
        0.02,
        0.02
      ]
    },
    {
      "id": "person-orange",
      "label": "사람 ①",
      "cls": 1,
      "box": {
        "x": 0.65,
        "y": 0.445,
        "w": 0.065,
        "h": 0.285
      },
      "center": [
        0.6825,
        0.5875
      ],
      "pixel": [
        1120,
        542
      ],
      "rgb": [
        188,
        83,
        44
      ],
      "prob": [
        0.02,
        0.8,
        0.1,
        0.02,
        0.02,
        0.02,
        0.02
      ]
    },
    {
      "id": "person-blue",
      "label": "사람 ②",
      "cls": 1,
      "box": {
        "x": 0.745,
        "y": 0.422,
        "w": 0.07,
        "h": 0.315
      },
      "center": [
        0.78,
        0.5795
      ],
      "pixel": [
        1317,
        495
      ],
      "rgb": [
        26,
        59,
        97
      ],
      "prob": [
        0.02,
        0.8,
        0.1,
        0.02,
        0.02,
        0.02,
        0.02
      ]
    },
    {
      "id": "bus",
      "label": "버스",
      "cls": 2,
      "box": {
        "x": 0.035,
        "y": 0.415,
        "w": 0.23,
        "h": 0.265
      },
      "center": [
        0.15,
        0.5475
      ],
      "pixel": [
        252,
        540
      ],
      "rgb": [
        0,
        101,
        210
      ],
      "prob": [
        0.02,
        0.02,
        0.8,
        0.1,
        0.02,
        0.02,
        0.02
      ]
    },
    {
      "id": "bicycle",
      "label": "자전거",
      "cls": 3,
      "box": {
        "x": 0.84,
        "y": 0.52,
        "w": 0.145,
        "h": 0.31
      },
      "center": [
        0.9125,
        0.675
      ],
      "pixel": [
        1482,
        641
      ],
      "rgb": [
        35,
        89,
        97
      ],
      "prob": [
        0.02,
        0.02,
        0.02,
        0.8,
        0.1,
        0.02,
        0.02
      ]
    },
    {
      "id": "signal",
      "label": "신호등",
      "cls": 4,
      "box": {
        "x": 0.885,
        "y": 0.03,
        "w": 0.055,
        "h": 0.25
      },
      "center": [
        0.9125,
        0.155
      ],
      "pixel": [
        1517,
        104
      ],
      "rgb": [
        242,
        27,
        19
      ],
      "prob": [
        0.02,
        0.02,
        0.02,
        0.02,
        0.8,
        0.1,
        0.02
      ]
    },
    {
      "id": "dog",
      "label": "강아지",
      "cls": 5,
      "box": {
        "x": 0.695,
        "y": 0.64,
        "w": 0.045,
        "h": 0.095
      },
      "center": [
        0.7175,
        0.6875
      ],
      "pixel": [
        1180,
        644
      ],
      "rgb": [
        165,
        116,
        82
      ],
      "prob": [
        0.02,
        0.02,
        0.02,
        0.02,
        0.02,
        0.8,
        0.1
      ]
    },
    {
      "id": "cat",
      "label": "고양이",
      "cls": 6,
      "box": {
        "x": 0.008,
        "y": 0.695,
        "w": 0.09,
        "h": 0.12
      },
      "center": [
        0.053,
        0.755
      ],
      "pixel": [
        123,
        693
      ],
      "rgb": [
        182,
        168,
        163
      ],
      "prob": [
        0.1,
        0.02,
        0.02,
        0.02,
        0.02,
        0.02,
        0.8
      ]
    }
  ]
});
