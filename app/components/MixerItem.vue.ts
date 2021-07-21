import Vue from 'vue';
import { Component, Prop } from 'vue-property-decorator';
import { EditMenu } from '../util/menus/EditMenu';
import { AudioSource } from '../services/audio';
import { CustomizationService } from 'services/customization';
import Slider from './shared/Slider.vue';
import MixerVolmeter from './MixerVolmeter.vue';
import { Inject } from '../services/core/injector';

@Component({
  components: { Slider, MixerVolmeter }
})
export default class MixerItem extends Vue {
  @Prop() audioSource: AudioSource;

  @Inject() private customizationService: CustomizationService;

  get previewEnabled() {
    return !this.customizationService.state.performanceMode;
  }

  setMuted(muted: boolean) {
    this.audioSource.setMuted(muted);
  }

  onSliderChangeHandler(newVal: number) {
    this.audioSource.setDeflection(newVal);
  }

  showSourceMenu(sourceId: string) {
    const menu = new EditMenu({
      selectedSourceId: sourceId,
      showAudioMixerMenu: true
    });
    menu.popup();
  }
}
