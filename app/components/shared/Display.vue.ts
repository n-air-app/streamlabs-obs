import Vue from 'vue';
import { Component, Prop, Watch } from 'vue-property-decorator';
import { Inject } from 'services/core/injector';
import { VideoService, Display as OBSDisplay } from 'services/video';
import { WindowsService } from 'services/windows';

@Component({})
export default class Display extends Vue {
  @Inject() videoService: VideoService;
  @Inject() windowsService: WindowsService;

  @Prop() sourceId: string;
  @Prop({ default: 0 }) paddingSize: number;
  @Prop({ default: false, type: Boolean }) drawUI: boolean;
  @Prop() clickHandler: boolean;

  $refs: {
    display: HTMLElement
  };

  display: OBSDisplay;

  mounted() {
    this.createDisplay();
  }

  onClickHandler(event: MouseEvent) {
    this.$emit('click', event);
  }

  createDisplay() {
    const displayId = this.videoService.getRandomDisplayId();
    this.display = new OBSDisplay(displayId, {
      sourceId: this.sourceId,
      paddingSize: this.paddingSize,
    });
    this.display.setShoulddrawUI(this.drawUI);

    this.display.onOutputResize(region => {
      this.$emit('outputResize', region);
    });

    this.display.trackElement(this.$refs.display);
  }

  destroyDisplay() {
    this.display.destroy();
  }

  @Watch('sourceId')
  changeSource() {
    this.updateDisplay();
  }

  updateDisplay() {
    this.destroyDisplay();
    this.createDisplay();
  }

  beforeDestroy() {
    this.destroyDisplay();
  }

}
