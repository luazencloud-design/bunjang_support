// 번개장터 실제 카테고리 트리 — m.bunjang.co.kr/products/new 직접 추출
// 추출일: 2026-04-24  버전: v2 (실측)
// 구조: 대분류 > 중분류 > 소분류

import type { CategoryTreeNode } from './types';

// 카테고리 선택 시 추가로 나타나는 옵션(사이즈 등) 정의
// key: '대분류>중분류' 또는 '대분류>중분류>소분류'
export const CATEGORY_EXTRA_OPTIONS: Record<string, { name: string; options: string[] }[]> = {
  // 신발 > 스니커즈 선택 시 사이즈
  '신발>스니커즈': [{ name: '사이즈', options: ['220','225','230','235','240','245','250','255','260','265','270','275','280','285','290','295','300'] }],
  '신발>남성화': [{ name: '사이즈', options: ['240','245','250','255','260','265','270','275','280','285','290','295','300'] }],
  '신발>여성화': [{ name: '사이즈', options: ['220','225','230','235','240','245','250','255','260','265','270'] }],
  '신발>스포츠화': [{ name: '사이즈', options: ['220','225','230','235','240','245','250','255','260','265','270','275','280','285','290','295','300'] }],
};

export const DEFAULT_CATEGORY_TREE: CategoryTreeNode[] = [
  {
    name: '여성의류',
    children: [
      { name: '아우터', children: [
        {name:'패딩'},{name:'점퍼'},{name:'코트'},{name:'자켓'},{name:'가디건'},{name:'조끼/베스트'},
      ]},
      { name: '상의', children: [
        {name:'니트/스웨터'},{name:'후드티/후드집업'},{name:'맨투맨'},{name:'블라우스'},
        {name:'셔츠'},{name:'반팔 티셔츠'},{name:'긴팔 티셔츠'},{name:'민소매 티셔츠'},
      ]},
      { name: '바지', children: [
        {name:'데님/청바지'},{name:'슬랙스'},{name:'면바지'},{name:'반바지'},
        {name:'트레이닝/조거팬츠'},{name:'레깅스'},{name:'기타 바지'},
      ]},
      { name: '치마', children: [
        {name:'롱 스커트'},{name:'미디 스커트'},{name:'미니 스커트'},
      ]},
      { name: '원피스', children: [
        {name:'롱 원피스'},{name:'미디 원피스'},{name:'미니 원피스'},
      ]},
      { name: '점프수트', children: [] },
      { name: '셋업/세트', children: [
        {name:'정장/셋업'},{name:'트레이닝/스웨트 셋업'},{name:'기타 셋업/세트'},
      ]},
      { name: '언더웨어/홈웨어', children: [
        {name:'홈웨어'},{name:'언더웨어'},
      ]},
      { name: '테마/이벤트', children: [
        {name:'코스튬/코스프레'},{name:'한복'},{name:'드레스'},{name:'기타 테마/이벤트'},
      ]},
    ],
  },
  {
    name: '남성의류',
    children: [
      { name: '아우터', children: [
        {name:'패딩'},{name:'점퍼'},{name:'코트'},{name:'자켓'},{name:'가디건'},{name:'조끼/베스트'},
      ]},
      { name: '상의', children: [
        {name:'후드티/후드집업'},{name:'맨투맨'},{name:'니트/스웨터'},{name:'셔츠'},
        {name:'반팔 티셔츠'},{name:'긴팔 티셔츠'},{name:'민소매 티셔츠'},
      ]},
      { name: '바지', children: [
        {name:'데님/청바지'},{name:'면바지'},{name:'슬랙스'},
        {name:'트레이닝/조거팬츠'},{name:'반바지'},{name:'기타 바지'},
      ]},
      { name: '점프수트', children: [] },
      { name: '셋업/세트', children: [
        {name:'정장/셋업'},{name:'트레이닝/스웨트 셋업'},{name:'기타 셋업/세트'},
      ]},
      { name: '언더웨어/홈웨어', children: [
        {name:'언더웨어'},{name:'홈웨어'},
      ]},
      { name: '테마/이벤트', children: [
        {name:'코스튬/코스프레'},{name:'한복'},{name:'기타 테마/이벤트'},
      ]},
    ],
  },
  {
    name: '신발',
    children: [
      { name: '스니커즈', children: [] },
      { name: '남성화', children: [
        {name:'샌들/슬리퍼'},{name:'구두/로퍼'},{name:'워커/부츠'},{name:'기타 남성화'},
      ]},
      { name: '여성화', children: [
        {name:'샌들/슬리퍼'},{name:'구두'},{name:'단화/플랫슈즈'},{name:'워커/부츠'},{name:'기타 여성화'},
      ]},
      { name: '스포츠화', children: [
        {name:'농구화'},{name:'골프화'},{name:'축구/풋살화'},{name:'테니스화'},
        {name:'등산화/트레킹화'},{name:'야구화'},{name:'기타 스포츠화'},
      ]},
    ],
  },
  {
    name: '가방/지갑',
    children: [
      { name: '여성가방', children: [] },
      { name: '남성가방', children: [] },
      { name: '여행용 가방', children: [] },
      { name: '여성지갑', children: [] },
      { name: '남성지갑', children: [] },
      { name: '기타 지갑', children: [] },
    ],
  },
  {
    name: '시계',
    children: [
      { name: '남성시계', children: [] },
      { name: '여성시계', children: [] },
      { name: '시계용품', children: [] },
    ],
  },
  {
    name: '쥬얼리',
    children: [
      { name: '귀걸이/피어싱', children: [] },
      { name: '목걸이/펜던트', children: [] },
      { name: '팔찌', children: [] },
      { name: '발찌', children: [] },
      { name: '반지', children: [] },
      { name: '쥬얼리 세트', children: [] },
      { name: '기타 쥬얼리', children: [] },
    ],
  },
  {
    name: '패션 액세서리',
    children: [
      { name: '모자', children: [
        {name:'볼캡'},{name:'버킷'},{name:'스냅백'},{name:'비니'},{name:'기타(모자)'},
      ]},
      { name: '안경/선글라스', children: [] },
      { name: '목도리/장갑', children: [] },
      { name: '스카프/넥타이', children: [] },
      { name: '벨트', children: [] },
      { name: '양말/스타킹', children: [] },
      { name: '우산/양산', children: [] },
      { name: '키링/키케이스', children: [] },
      { name: '기타 액세서리', children: [] },
    ],
  },
  {
    name: '디지털',
    children: [
      { name: '휴대폰', children: [] },
      { name: '태블릿', children: [] },
      { name: '웨어러블(워치/밴드)', children: [] },
      { name: '오디오/영상/관련기기', children: [] },
      { name: 'PC/노트북', children: [] },
      { name: '게임/타이틀', children: [
        {name:'닌텐도/NDS/Wii'},{name:'소니/플레이스테이션'},{name:'XBOX'},
        {name:'PC게임'},{name:'기타 게임/타이틀'},
      ]},
      { name: '카메라/DSLR', children: [] },
      { name: 'PC부품/저장장치', children: [] },
    ],
  },
  {
    name: '가전제품',
    children: [
      { name: '생활가전', children: [
        {name:'마사지기'},{name:'청소기'},{name:'공기청정기'},{name:'가습기'},
        {name:'제습기'},{name:'선풍기/냉풍기'},{name:'히터/온풍기'},{name:'전기매트/장판'},
        {name:'다리미'},{name:'미싱/재봉틀'},
      ]},
      { name: '주방가전', children: [
        {name:'인덕션/전기레인지'},{name:'전기밥솥'},{name:'커피머신'},{name:'에어프라이어'},
        {name:'믹서기/블렌더'},{name:'식기세척기'},{name:'정수기'},{name:'오븐'},
        {name:'전기포트'},{name:'토스터'},{name:'전자레인지'},{name:'음식물 처리기'},
      ]},
      { name: '미용가전', children: [
        {name:'피부케어기기'},{name:'고데기'},{name:'드라이기'},{name:'면도기/이발기'},{name:'제모기'},
      ]},
      { name: '냉장고', children: [] },
      { name: '에어컨', children: [] },
      { name: '세탁기/건조기', children: [] },
      { name: 'TV', children: [] },
      { name: '사무기기(복사기/팩스 등)', children: [] },
      { name: '기타 가전제품', children: [] },
    ],
  },
  {
    name: '스포츠/레저',
    children: [
      { name: '골프', children: [] },
      { name: '캠핑', children: [] },
      { name: '낚시', children: [] },
      { name: '축구', children: [] },
      { name: '야구', children: [] },
      { name: '농구', children: [] },
      { name: '자전거', children: [] },
      { name: '등산/클라이밍', children: [] },
      { name: '헬스/요가/필라테스', children: [] },
      { name: '인라인/스케이트보드', children: [] },
      { name: '전동킥보드/전동휠', children: [] },
      { name: '테니스', children: [] },
      { name: '배드민턴', children: [] },
      { name: '볼링', children: [] },
      { name: '탁구', children: [] },
      { name: '당구', children: [] },
      { name: '겨울 스포츠', children: [
        {name:'스키/보드 의류 및 잡화'},{name:'스노우보드 장비'},{name:'스키 장비'},{name:'기타 겨울 스포츠'},
      ]},
      { name: '수상 스포츠', children: [
        {name:'남성 수영복/래쉬가드'},{name:'여성 수영복/래쉬가드'},{name:'수영/물놀이 용품'},{name:'서핑'},{name:'기타 수상 스포츠'},
      ]},
      { name: '격투/무술', children: [
        {name:'복싱'},{name:'주짓수'},{name:'기타 격투/무술'},
      ]},
      { name: '기타 스포츠', children: [] },
    ],
  },
  {
    name: '차량/오토바이',
    children: [
      { name: '차량 용품/부품', children: [
        {name:'타이어/휠'},{name:'차량 부품'},{name:'차량/튜닝 용품'},
        {name:'네비게이션/블랙박스'},{name:'카오디오/영상'},
      ]},
      { name: '오토바이/스쿠터', children: [
        {name:'오토바이(125cc 이하)'},{name:'오토바이(125cc 초과)'},
      ]},
      { name: '오토바이 용품/부품', children: [
        {name:'라이더 용품'},{name:'오토바이 부품'},{name:'오토바이/튜닝 용품'},{name:'기타(오토바이 용품/부품)'},
      ]},
    ],
  },
  {
    name: '스타굿즈',
    children: [
      { name: '보이그룹', children: [
        {name:'음반/영상물'},{name:'팬시/포토카드'},{name:'포스터/화보'},
        {name:'인형/피규어'},{name:'응원도구'},{name:'의류/패션잡화'},{name:'기타(보이그룹)'},
      ]},
      { name: '걸그룹', children: [] },
      { name: '솔로(남)', children: [] },
      { name: '솔로(여)', children: [] },
      { name: '배우(남)', children: [] },
      { name: '배우(여)', children: [] },
      { name: '방송/예능/캐릭터', children: [] },
      { name: '기타', children: [] },
    ],
  },
  {
    name: '키덜트',
    children: [
      { name: '피규어/인형', children: [] },
      { name: '레고/블럭', children: [] },
      { name: '프라모델', children: [] },
      { name: 'RC/드론', children: [] },
      { name: '보드게임', children: [] },
      { name: '서바이벌건', children: [] },
      { name: '기타(키덜트)', children: [] },
    ],
  },
  {
    name: '예술/희귀/수집품',
    children: [
      { name: '희귀/수집품', children: [] },
      { name: '골동품', children: [] },
      { name: '예술작품', children: [] },
    ],
  },
  {
    name: '음반/악기',
    children: [
      { name: 'CD/DVD/LP', children: [] },
      { name: '악기', children: [] },
    ],
  },
  {
    name: '도서/티켓/문구',
    children: [
      { name: '도서', children: [] },
      { name: '문구', children: [] },
      { name: '기프티콘/쿠폰', children: [] },
      { name: '상품권', children: [] },
      { name: '티켓', children: [] },
    ],
  },
  {
    name: '뷰티/미용',
    children: [
      { name: '스킨케어', children: [
        {name:'클렌징/스크럽'},{name:'스킨/토너/미스트'},{name:'로션/에멀젼'},
        {name:'에센스/크림'},{name:'팩/마스크'},{name:'썬케어'},{name:'기타(스킨케어)'},
      ]},
      { name: '색조메이크업', children: [
        {name:'아이라이너/브로우'},{name:'아이섀도우'},{name:'마스카라'},{name:'립틴트'},
        {name:'립밤/립글로즈'},{name:'립스틱'},{name:'치크/블러셔'},{name:'기타(색조메이크업)'},
      ]},
      { name: '베이스메이크업', children: [
        {name:'메이크업베이스'},{name:'BB/CC크림'},{name:'쿠션팩트'},{name:'파운데이션'},
        {name:'파우더/팩트'},{name:'프라이머/컨실러'},{name:'기타(베이스메이크업)'},
      ]},
      { name: '바디/헤어케어', children: [] },
      { name: '향수/아로마', children: [] },
      { name: '네일아트/케어', children: [] },
      { name: '미용소품/기기', children: [] },
      { name: '다이어트/이너뷰티', children: [] },
      { name: '남성 화장품', children: [] },
    ],
  },
  {
    name: '가구/인테리어',
    children: [
      { name: '가구', children: [] },
      { name: '침구', children: [] },
      { name: '수공예/수선', children: [] },
      { name: '셀프 인테리어 용품', children: [] },
      { name: '인테리어 소품', children: [] },
      { name: '꽃/원예', children: [] },
      { name: '조명', children: [] },
      { name: '카페트/러그/매트', children: [] },
      { name: '커튼/블라인드', children: [] },
    ],
  },
  {
    name: '생활/주방용품',
    children: [
      { name: '주방용품', children: [] },
      { name: '욕실용품', children: [] },
      { name: '생활용품', children: [] },
    ],
  },
  {
    name: '공구/산업용품',
    children: [
      { name: '드릴/전동공구', children: [] },
      { name: '수공구/가정용 공구', children: [] },
      { name: '공구함', children: [] },
      { name: '산업용품/자재', children: [] },
      { name: '측정/계측/레벨', children: [] },
      { name: '공장기계/용접/가스', children: [] },
      { name: '에어/유압공구', children: [] },
      { name: '기타 산업용품', children: [] },
    ],
  },
  {
    name: '식품',
    children: [
      { name: '건강식품', children: [] },
      { name: '농수축산물', children: [] },
      { name: '간식', children: [] },
      { name: '커피/차', children: [] },
      { name: '생수/음료', children: [] },
      { name: '면/통조림', children: [] },
      { name: '장/소스/오일', children: [] },
      { name: '간편조리식품', children: [] },
      { name: '기타 식품', children: [] },
    ],
  },
  {
    name: '유아동/출산',
    children: [
      { name: '베이비의류(0-2세)', children: [] },
      { name: '여아의류(3-6세)', children: [] },
      { name: '남아의류(3-6세)', children: [] },
      { name: '여주니어의류(7세~)', children: [] },
      { name: '남주니어의류(7세~)', children: [] },
      { name: '신발/가방/잡화', children: [] },
      { name: '유아동용품', children: [] },
      { name: '임부 의류/용품', children: [] },
      { name: '교구/완구/인형', children: [] },
      { name: '수유/이유용품', children: [] },
    ],
  },
  {
    name: '반려동물용품',
    children: [
      { name: '강아지 용품', children: [] },
      { name: '강아지 사료/간식', children: [] },
      { name: '기타(강아지)', children: [] },
      { name: '고양이 용품', children: [] },
      { name: '고양이 사료/간식', children: [] },
      { name: '기타(고양이)', children: [] },
      { name: '기타(반려동물 용품)', children: [] },
      { name: '기타(반려동물 사료/간식)', children: [] },
    ],
  },
  {
    name: '기타',
    children: [],
  },
  {
    name: '재능',
    children: [
      { name: '디자인/영상/사진', children: [] },
      { name: '생활서비스/지식', children: [] },
      { name: '스타일/뷰티', children: [] },
      { name: '블로그/문서/번역', children: [] },
      { name: '거래 대행', children: [] },
      { name: '기타 재능', children: [] },
    ],
  },
];
