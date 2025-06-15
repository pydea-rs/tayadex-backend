
export class PointService {
  private static singleInstance: PointService;

  public static get() {
    if(PointService.singleInstance) {
      return PointService.singleInstance;
    }
    return new PointService();
  }

  private constructor() {
    if(PointService.singleInstance) {
      PointService.singleInstance
    }
  }

  async award(...args: any[]) {}

  async rewardOrPunish(...args: any[]) {}
}
