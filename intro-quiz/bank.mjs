// Official video links checked on 2026-11-24. Embedding and intro offsets
// require a classroom preflight; availability is controlled by YouTube.
const rows = [
  [2024,'Supernova','aespa','phuiiNCxRMg','SkP_MvTKTJM'],
  [2024,'Magnetic','ILLIT','Vk5-c_v4gMU'],
  [2024,'첫 만남은 계획대로 되지 않아','TWS','hVAc1Vf2ITU'],
  [2024,'나는 아픈 건 딱 질색이니까','(여자)아이들','ATK7gAaZTOM'],
  [2024,'해야 (HEYA)','IVE','07EzMbVH3QE'],
  [2024,'HAPPY','DAY6','2o1zdX72400'],
  [2024,'Whiplash','aespa','jWQx2f-CErU'],
  [2024,'Armageddon','aespa','nFYwcndNuOY'],
  [2024,'APT.','ROSÉ & Bruno Mars','ekr2nIex040','tQRt_P_-EHg'],
  [2024,'CRAZY','LE SSERAFIM','n6B5gQXlB-0'],
  [2025,'REBEL HEART','IVE','g36q0ZLvygQ'],
  [2025,'ATTITUDE','IVE','38xYeot-ciM'],
  [2025,'뛰어 (JUMP)','BLACKPINK','CgCVZdcKcqY'],
  [2025,'like JENNIE','JENNIE','aS7al94FVbk'],
  [2025,'Dirty Work','aespa','M2WTUoy4y6E'],
  [2025,'TOO BAD','G-DRAGON feat. Anderson .Paak','o9DhvbqYzns'],
  [2025,'Rich Man','aespa','5oQVTnq-UKk'],
  [2025,'XOXZ','IVE','B1ShLiq3EVc'],
  [2025,'HOT','LE SSERAFIM','r9AEGPB6qIU'],
  [2025,'Golden','HUNTR/X','yebNIHKAC4A'],
  [2026,'BANG BANG','IVE','9qkpcLK422o'],
  [2026,'SWIM','BTS','b4iVv91Z6lY'],
  [2026,'LEMONADE','aespa','83C3TZ4Zm_o','LBhcqYqeu0U'],
  [2026,'404 (New Era)','KiiiKiii','zhHB4dZTChw'],
  [2026,'RUDE!','Hearts2Hearts','F7sGJVUrkjQ'],
  [2026,'춤 (CHOOM)','BABYMONSTER','x3eqqoZPV_E'],
  [2026,'Heavy Serenade','NMIXX','6Ycn9qZK09I'],
  [2026,'캐치 캐치 (Catch Catch)','YENA','NOiyDlWl534'],
  [2026,"It’s Me",'ILLIT','bMhDJ0S0OBA'],
  [2026,'2.0','BTS','_gyultVTesk'],
];
export const BANK = rows.map(([year,title,artist,answerVideo,introVideo],i)=>({
  id:`song-${i+1}`,year,title,artist,genre:'K-pop',introVideo:introVideo||answerVideo,
  answerVideo,introStart:0,answerStart:0,checked:false
}));
